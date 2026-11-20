import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const mode = key.startsWith("sk_test_") || key.startsWith("rk_test_") ? "test" : key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : "missing";
const kind = key.startsWith("rk_") ? "restricted" : key.startsWith("sk_") ? "secret" : "unknown";
if (!key) {
  console.log(JSON.stringify({ ok: false, reason: "missing key" }));
  process.exit(1);
}

const stripe = new Stripe(key);

const account = await stripe.accounts.retrieve().then(
  (value) => ({ id: value.id, country: value.country, chargesEnabled: value.charges_enabled }),
  (error) => ({ error: error instanceof Error ? error.message : "account lookup failed" })
);

async function ensurePrice(lookupKey, name, unitAmount) {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const found = existing.data[0];
  if (found?.product && typeof found.product === "string") {
    return { lookupKey, priceId: found.id, productId: found.product, created: false };
  }
  const product = await stripe.products.create({ name });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: unitAmount,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: lookupKey,
  });
  return { lookupKey, priceId: price.id, productId: product.id, created: true };
}

const paid = await ensurePrice("simplyfit_paid_monthly", "Simply Fit Paid", 1200);
const unlimited = await ensurePrice("simplyfit_unlimited_monthly", "Simply Fit Unlimited", 2900);

const features = {
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: true, mode: "at_period_end" },
  subscription_update: {
    enabled: true,
    default_allowed_updates: ["price"],
    proration_behavior: "create_prorations",
    products: [
      { product: paid.productId, prices: [paid.priceId] },
      { product: unlimited.productId, prices: [unlimited.priceId] },
    ],
  },
};

const configs = await stripe.billingPortal.configurations.list({ limit: 20, active: true });
const current = configs.data.find((config) => config.metadata?.simplyfit === "portal");
let portalId;
if (current) {
  await stripe.billingPortal.configurations.update(current.id, { features });
  portalId = current.id;
} else {
  const created = await stripe.billingPortal.configurations.create({
    metadata: { simplyfit: "portal" },
    business_profile: { headline: "Manage your Simply Fit subscription" },
    features,
  });
  portalId = created.id;
}

const wanted = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.dispute.created",
  "charge.refunded",
  "radar.early_fraud_warning.created",
];
const hooks = await stripe.webhookEndpoints.list({ limit: 20 });
const endpoints = [];
for (const hook of hooks.data) {
  if (hook.url.includes("/api/billing/webhook")) {
    await stripe.webhookEndpoints.update(hook.id, { enabled_events: wanted });
  }
  endpoints.push({ url: hook.url, status: hook.status, events: wanted });
}

console.log(JSON.stringify({ ok: true, mode, kind, account, paid, unlimited, portalId, endpoints }, null, 2));
