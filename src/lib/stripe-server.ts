import "server-only";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readAccess } from "@/lib/admin";
import { PAID_PRICE_CENTS, PLAN_LOOKUP, UNLIMITED_PRICE_CENTS, type PaidPlan } from "@/lib/billing";
import type { AccountAccess, BillingState, Settings } from "@/lib/types";

let stripe: Stripe | null = null;
let stripeKeyUsed = "";

function stripeSecret() {
  const raw = process.env.STRIPE_SECRET_KEY ?? "";
  const compact = raw.replace(/[^A-Za-z0-9_]/g, "");
  const match = compact.match(/(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{20,}/);
  return match?.[0] ?? "";
}

export function getStripe() {
  const key = stripeSecret();
  if (!key) return null;
  if (!stripe || stripeKeyUsed !== key) {
    stripe = new Stripe(key);
    stripeKeyUsed = key;
  }
  return stripe;
}

export function publicOrigin(requestUrl: string) {
  const requestOrigin = new URL(requestUrl).origin;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!configured) return requestOrigin;
  try {
    const host = new URL(configured).hostname;
    const local = host === "localhost" || host === "127.0.0.1";
    const requestLocal = requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1");
    if (local && !requestLocal) return requestOrigin;
  } catch {
    return requestOrigin;
  }
  return configured;
}

export function billingFailure(error: unknown) {
  const record = typeof error === "object" && error !== null ? (error as { type?: string; code?: string; message?: string }) : {};
  console.error("[billing]", record.type || "error", record.code || "unknown");
  const raw = record.message || (error instanceof Error ? error.message : "");
  if (record.type === "StripeAuthenticationError" || /api key/i.test(raw) || /(?:sk|rk)_(?:live|test)_|\*{6,}|whsec_/i.test(raw)) {
    return "Billing couldn't reach Stripe. Try again in a moment.";
  }
  const scrubbed = raw
    .replace(/(?:sk|rk)_(?:live|test)_[\w*]*/gi, "")
    .replace(/whsec_[\w*]*/gi, "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return scrubbed.slice(0, 180) || "Couldn't open billing.";
}

function integrationIdentifier() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `simplyfit_checkout_${suffix}`;
}

async function ensurePrice(client: Stripe, lookupKey: string, name: string, unitAmount: number) {
  const existing = await client.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const found = existing.data[0];
  if (found?.product && typeof found.product === "string") return { priceId: found.id, productId: found.product };
  const product = await client.products.create({ name });
  const price = await client.prices.create({
    product: product.id,
    unit_amount: unitAmount,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: lookupKey,
  });
  return { priceId: price.id, productId: product.id };
}

export async function ensureCatalog(client: Stripe) {
  const paid = await ensurePrice(client, PLAN_LOOKUP.paid, "Simply Fit Paid", PAID_PRICE_CENTS);
  const unlimited = await ensurePrice(client, PLAN_LOOKUP.unlimited, "Simply Fit Unlimited", UNLIMITED_PRICE_CENTS);
  return { paid, unlimited };
}

async function portalConfiguration(client: Stripe, catalog: Awaited<ReturnType<typeof ensureCatalog>>) {
  const configs = await client.billingPortal.configurations.list({ limit: 20, active: true });
  const current = configs.data.find((config) => config.metadata?.simplyfit === "portal");
  const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
      products: [
        { product: catalog.paid.productId, prices: [catalog.paid.priceId] },
        { product: catalog.unlimited.productId, prices: [catalog.unlimited.priceId] },
      ],
    },
  };
  if (current) {
    await client.billingPortal.configurations.update(current.id, { features });
    return current.id;
  }
  const created = await client.billingPortal.configurations.create({
    metadata: { simplyfit: "portal" },
    business_profile: { headline: "Manage your Simply Fit subscription" },
    features,
  });
  return created.id;
}

export async function createCheckout(opts: { customerId?: string | null; plan: PaidPlan; successUrl: string; cancelUrl: string }) {
  const client = getStripe();
  if (!client) return null;
  const catalog = await ensureCatalog(client);
  const price = opts.plan === "paid" ? catalog.paid.priceId : catalog.unlimited.priceId;
  const session = await client.checkout.sessions.create({
    mode: "subscription",
    ...(opts.customerId ? { customer: opts.customerId } : {}),
    line_items: [{ price, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    integration_identifier: integrationIdentifier(),
    allow_promotion_codes: true,
    // This account has Managed Payments on by default, which requires a product tax code.
    // Leave it off until there's a tax registration. Simply Fit remains the merchant.
    managed_payments: { enabled: false },
  });
  return session.url;
}

export async function createPlanPortal(opts: { customerId: string; plan: "free" | PaidPlan; returnUrl: string }) {
  const client = getStripe();
  if (!client) return null;
  const catalog = await ensureCatalog(client);
  const configuration = await portalConfiguration(client, catalog);
  const listed = await client.subscriptions.list({ customer: opts.customerId, status: "all", limit: 10 });
  const subscription = listed.data.find((item) => item.status === "active" || item.status === "trialing" || item.status === "past_due");
  if (!subscription) return createPortal(opts.customerId, opts.returnUrl);
  const itemId = subscription.items.data[0]?.id;
  const price = opts.plan === "paid" ? catalog.paid.priceId : opts.plan === "unlimited" ? catalog.unlimited.priceId : null;
  const flow =
    opts.plan === "free" || !itemId || !price
      ? { type: "subscription_cancel" as const, subscription_cancel: { subscription: subscription.id } }
      : {
          type: "subscription_update_confirm" as const,
          subscription_update_confirm: { subscription: subscription.id, items: [{ id: itemId, price, quantity: 1 }] },
        };
  const session = await client.billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: opts.returnUrl,
    configuration,
    flow_data: {
      ...flow,
      after_completion: { type: "redirect", redirect: { return_url: opts.returnUrl } },
    },
  });
  return session.url;
}

export async function createPortal(customerId: string, returnUrl: string) {
  const client = getStripe();
  if (!client) return null;
  const catalog = await ensureCatalog(client);
  const configuration = await portalConfiguration(client, catalog);
  const session = await client.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl, configuration });
  return session.url;
}

function periodEnd(subscription: Stripe.Subscription) {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

function tierForLookup(lookup: string | null | undefined): PaidPlan | null {
  if (lookup === PLAN_LOOKUP.paid) return "paid";
  if (lookup === PLAN_LOOKUP.unlimited) return "unlimited";
  return null;
}

function tierForSubscription(subscription: Stripe.Subscription | null): "free" | PaidPlan {
  if (!subscription) return "free";
  const price = subscription.items.data[0]?.price;
  const tier = tierForLookup(price?.lookup_key);
  const live = subscription.status === "active" || subscription.status === "trialing" || subscription.status === "past_due";
  return live && tier ? tier : "free";
}

async function profileForCustomer(customerId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin.from("profiles").select("id, settings").eq("settings->billing->>customerId", customerId).maybeSingle();
  if (data) return data as { id: string; settings: Settings };
  const client = getStripe();
  if (!client) return null;
  const customer = await client.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const userId = customer.metadata?.user_id;
  if (userId) {
    const fallback = await admin.from("profiles").select("id, settings").eq("id", userId).maybeSingle();
    if (fallback.data) return fallback.data as { id: string; settings: Settings };
  }
  const email = customer.email?.trim();
  if (!email) return null;
  const byEmail = await admin.from("profiles").select("id, settings").ilike("email", email).maybeSingle();
  const match = byEmail.data as { id: string; settings: Settings } | null;
  if (!match) return null;
  await client.customers.update(customerId, { metadata: { ...(customer.metadata ?? {}), user_id: match.id } });
  return match;
}

export async function claimCustomerForUser(userId: string, email: string) {
  const client = getStripe();
  if (!client || !email.trim()) return false;
  const listed = await client.customers.list({ email: email.trim(), limit: 10 });
  let chosen: Stripe.Customer | null = null;
  for (const customer of listed.data) {
    const subs = await client.subscriptions.list({ customer: customer.id, status: "all", limit: 1 });
    if (subs.data.length) {
      chosen = customer;
      break;
    }
    chosen ??= customer;
  }
  if (!chosen) return false;
  if (chosen.metadata?.user_id !== userId) {
    await client.customers.update(chosen.id, { metadata: { ...(chosen.metadata ?? {}), user_id: userId } });
  }
  await rememberCustomer(userId, chosen.id);
  await syncCustomerSubscription(chosen.id);
  return true;
}

export async function syncCustomerSubscription(customerId: string, patch: Partial<BillingState> = {}) {
  const client = getStripe();
  const admin = getSupabaseAdmin();
  if (!client || !admin) return;
  const profile = await profileForCustomer(customerId);
  if (!profile) return;
  const listed = await client.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  const subscription =
    listed.data.find((item) => item.status === "active" || item.status === "trialing" || item.status === "past_due") ??
    listed.data.find((item) => item.status !== "canceled") ??
    listed.data[0] ??
    null;
  const access = readAccess(profile.settings);
  const tier = tierForSubscription(subscription);
  const nextPlan: AccountAccess["plan"] = access.plan === "granted" ? "granted" : tier;
  const status = (subscription?.status ?? "none") as BillingState["status"];
  const billing: BillingState = {
    customerId,
    subscriptionId: subscription?.id ?? null,
    status: ["active", "trialing", "past_due", "canceled", "unpaid", "incomplete"].includes(status) ? status : "none",
    currentPeriodEnd: subscription ? periodEnd(subscription) : null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    disputed: patch.disputed ?? Boolean(profile.settings.billing?.disputed),
    refunded: patch.refunded ?? Boolean(profile.settings.billing?.refunded),
    fraudWarning: patch.fraudWarning ?? Boolean(profile.settings.billing?.fraudWarning),
  };
  const settings: Settings = { ...profile.settings, access: { ...access, plan: nextPlan }, billing };
  const { error } = await admin.from("profiles").update({ settings }).eq("id", profile.id);
  if (error) throw new Error(error.message);
}

export async function rememberCustomer(userId: string, customerId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { data, error } = await admin.from("profiles").select("settings").eq("id", userId).maybeSingle();
  if (error || !data) return;
  const settings = (data.settings ?? {}) as Settings;
  const billing = { ...(settings.billing ?? {}), customerId };
  await admin.from("profiles").update({ settings: { ...settings, billing } }).eq("id", userId);
}

export async function customerIdFromCharge(chargeId: string) {
  const client = getStripe();
  if (!client) return null;
  const charge = await client.charges.retrieve(chargeId);
  const customer = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  return customer ?? null;
}
