import type { AccountAccess, BillingState, Settings } from "./types";

/** Sellable tiers. Complimentary admin access uses `granted` and is treated as Unlimited. */
export type PaidPlan = "paid" | "unlimited";
export type AccountTier = "free" | PaidPlan;

export const PAID_PRICE_CENTS = 1200;
export const UNLIMITED_PRICE_CENTS = 2900;

export const PLAN_LOOKUP = {
  paid: "simplyfit_paid_monthly",
  unlimited: "simplyfit_unlimited_monthly",
} as const;

export interface PlanOffer {
  id: AccountTier;
  name: string;
  price: number;
  blurb: string;
  features: string[];
  highlight?: boolean;
}

export const PLAN_OFFERS: PlanOffer[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    blurb: "The whole plan, with a small taste of cloud AI.",
    features: ["Calories, training, and logging", "3 text meal estimates a day", "2 AI training drafts a month", "10 saved meals"],
  },
  {
    id: "paid",
    name: "Paid",
    price: 12,
    blurb: "Enough AI for a normal day of meals, photos, and voice notes.",
    features: ["25 text meal estimates a day", "8 photos and 8 voice notes a day", "15 AI training drafts a month", "200 saved meals"],
    highlight: true,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    price: 29,
    blurb: "No counter on meals, photos, voice, or saved meals.",
    features: ["No daily meal counter", "Photos and voice included", "No cap on AI training drafts", "Saved meals with no cap"],
  },
];

export function accountTier(plan: AccountAccess["plan"] | null | undefined): AccountTier {
  if (plan === "paid") return "paid";
  if (plan === "unlimited" || plan === "granted") return "unlimited";
  return "free";
}

export function planOffer(id: AccountTier) {
  return PLAN_OFFERS.find((offer) => offer.id === id) ?? PLAN_OFFERS[0];
}

export function readBilling(settings: Pick<Settings, "billing"> | null | undefined): BillingState {
  const billing = settings?.billing;
  const status = billing?.status;
  const known = ["none", "active", "trialing", "past_due", "canceled", "unpaid", "incomplete"] as const;
  return {
    customerId: billing?.customerId || null,
    subscriptionId: billing?.subscriptionId || null,
    status: known.includes(status as (typeof known)[number]) ? (status as BillingState["status"]) : "none",
    currentPeriodEnd: billing?.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(billing?.cancelAtPeriodEnd),
    disputed: Boolean(billing?.disputed),
    refunded: Boolean(billing?.refunded),
    fraudWarning: Boolean(billing?.fraudWarning),
  };
}

export function formatPlanPrice(dollars: number) {
  return dollars === 0 ? "$0" : `$${dollars}`;
}
