"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { accountTier, planOffer, readBilling, type AccountTier } from "@/lib/billing";
import { BillingAssurance, PlanCards, openBillingPortal, startPlan } from "@/components/billing/plan-cards";

export function SubscriptionPanel() {
  const { data, mode, reload } = useStore();
  const toast = useToast();
  const announced = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const tier = accountTier(data.profile.settings.access?.plan);
  const billing = readBilling(data.profile.settings);
  const offer = planOffer(tier);
  const renewal = billing.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  useEffect(() => {
    if (announced.current) return;
    const flag = new URLSearchParams(window.location.search).get("billing");
    if (!flag) return;
    announced.current = true;
    if (flag === "success" || flag === "updated") {
      toast(flag === "success" ? "Payment received. Your plan updates as soon as Stripe confirms it." : "Stripe confirmed the change. Your plan is updating.");
      void reload();
      const timers = [1500, 3500, 7000].map((delay) => window.setTimeout(() => void reload(), delay));
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    } else if (flag === "cancel") toast("Checkout canceled. Your plan is unchanged.");
  }, [reload, toast]);

  async function portal() {
    setBusy("portal");
    try {
      await openBillingPortal();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't open the billing portal.", "error");
      setBusy(null);
    }
  }

  async function choose(plan: AccountTier) {
    if (plan === tier) return;
    setBusy(plan);
    try {
      await startPlan(plan, "/settings");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't open billing.", "error");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[15px] font-medium">
          {offer.name}
          {offer.price > 0 && <span className="text-muted"> · ${offer.price}/month</span>}
          {tier === "unlimited" && data.profile.settings.access?.plan === "granted" && <span className="text-muted"> · complimentary</span>}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {billing.status === "past_due"
            ? "The last payment didn't go through. Update the card in the billing portal to keep this plan."
            : renewal
              ? billing.cancelAtPeriodEnd
                ? `Cancels on ${renewal}. You'll keep this plan until then.`
                : `Renews on ${renewal}.`
              : "Free stays free. Paid and Unlimited renew monthly until you cancel."}
        </p>
        {billing.disputed && <p className="mt-2 text-[13px] text-clay">A charge on this account is being disputed.</p>}
        {billing.fraudWarning && <p className="mt-2 text-[13px] text-clay">Stripe flagged a recent charge. Write to support if that wasn't you.</p>}
        {mode === "demo" && <p className="mt-2 text-[13px] text-muted">This browser demo can't charge a card. Subscriptions run on the hosted app.</p>}
      </div>
      <PlanCards current={tier} subscriber={Boolean(billing.customerId) && !["canceled", "none", "incomplete", "unpaid"].includes(billing.status)} busy={busy} onChoose={choose} />
      <BillingAssurance />
      {billing.customerId && (
        <Button variant="secondary" onClick={portal} loading={busy === "portal"}>
          Manage, cancel, or update payment
        </Button>
      )}
    </div>
  );
}
