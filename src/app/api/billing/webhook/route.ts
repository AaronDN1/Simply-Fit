import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { customerIdFromCharge, getStripe, syncCustomerSubscription } from "@/lib/stripe-server";

export const runtime = "nodejs";

function customerId(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function syncCharge(chargeId: string, patch: { disputed?: boolean; refunded?: boolean; fraudWarning?: boolean }) {
  const customer = await customerIdFromCharge(chargeId);
  if (customer) await syncCustomerSubscription(customer, patch);
}

function signingSecrets() {
  return [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_LOCAL].filter((value): value is string => Boolean(value));
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secrets = signingSecrets();
  if (!stripe || secrets.length === 0) return NextResponse.json({ error: "Stripe webhooks are not configured." }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  const payload = await req.text();
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
      break;
    } catch {
      event = null;
    }
  }
  if (!event) return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        if (event.type === "checkout.session.completed" && session.payment_status !== "paid" && session.payment_status !== "no_payment_required") break;
        const customer = customerId(session.customer);
        if (customer) await syncCustomerSubscription(customer);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = customerId(subscription.customer);
        if (customer) await syncCustomerSubscription(customer);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customer = customerId(invoice.customer);
        if (customer) await syncCustomerSubscription(customer);
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const charge = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
        if (charge) await syncCharge(charge, { disputed: true });
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        if (charge.customer) await syncCustomerSubscription(customerId(charge.customer)!, { refunded: true });
        break;
      }
      case "radar.early_fraud_warning.created": {
        const warning = event.data.object as Stripe.Radar.EarlyFraudWarning;
        const charge = typeof warning.charge === "string" ? warning.charge : warning.charge?.id;
        if (charge) await syncCharge(charge, { fraudWarning: true });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("stripe webhook", event.type, error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
