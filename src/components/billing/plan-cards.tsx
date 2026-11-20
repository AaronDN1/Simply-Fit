"use client";

import { useEffect, useState } from "react";
import { Check, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { accountTier, PLAN_OFFERS, formatPlanPrice, readBilling, type AccountTier, type PaidPlan } from "@/lib/billing";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

export function useViewerPlan() {
  const [state, setState] = useState<{ ready: boolean; signedIn: boolean; tier: AccountTier | null; subscriber: boolean }>({
    ready: false,
    signedIn: false,
    tier: null,
    subscriber: false,
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const session = await getSessionUser();
      const sb = getSupabaseBrowser();
      if (!session || !sb) {
        if (alive) setState({ ready: true, signedIn: false, tier: null, subscriber: false });
        return;
      }
      const { data } = await sb.from("profiles").select("settings").eq("id", session.id).maybeSingle();
      const settings = (data?.settings ?? {}) as Settings;
      const billing = readBilling(settings);
      const subscriber = Boolean(billing.customerId) && !["canceled", "none", "incomplete", "unpaid"].includes(billing.status);
      if (alive) setState({ ready: true, signedIn: true, tier: accountTier(settings.access?.plan), subscriber });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export function PlanCards({
  current,
  busy,
  subscriber = false,
  layout = "settings",
  onChoose,
}: {
  current?: AccountTier | null;
  busy?: string | null;
  subscriber?: boolean;
  layout?: "settings" | "marketing";
  onChoose: (plan: AccountTier) => void;
}) {
  const marketing = layout === "marketing";
  return (
    <div className={cn("grid gap-4 md:grid-cols-3", marketing ? "" : "gap-3")}>
      {PLAN_OFFERS.map((offer) => {
        const selected = current === offer.id;
        const label = selected
          ? "Your plan"
          : offer.id === "free"
            ? subscriber
              ? "Move to Free"
              : "Start free"
            : subscriber
              ? `Switch to ${offer.name}`
              : `Continue with ${offer.name}`;
        return (
          <article
            key={offer.id}
            className={cn(
              "flex flex-col bg-surface",
              marketing ? "rounded-[28px] p-6 sm:p-7" : "rounded-[24px] p-5",
              selected ? "border-2 border-accent" : offer.highlight ? "border border-accent shadow-[var(--shadow-lift)]" : "border border-line"
            )}
            aria-current={selected ? "true" : undefined}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className={cn("font-semibold tracking-tight", marketing ? "text-lg" : "text-[15px]")}>{offer.name}</h3>
              {selected ? (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent-strong">Your plan</span>
              ) : (
                offer.highlight && <span className="text-[12px] font-medium text-accent">Most people</span>
              )}
            </div>
            <p className={cn("font-display leading-none tabular", marketing ? "mt-4 text-[52px]" : "mt-3 text-[40px]")}>
              {formatPlanPrice(offer.price)}
              {offer.price > 0 && <span className={cn("ml-1 font-sans font-medium text-muted", marketing ? "text-[15px]" : "text-[14px]")}>/ month</span>}
            </p>
            <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.12em] text-muted">{offer.price > 0 ? "Billed monthly" : "No card required"}</p>
            <p className={cn("leading-relaxed text-muted", marketing ? "mt-3 text-[15px]" : "mt-3 text-[14px]")}>{offer.blurb}</p>
            <ul className={cn("space-y-2 text-ink-soft", marketing ? "mt-5 text-[14px]" : "mt-4 text-[13px]")}>
              {offer.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {selected ? (
              <p className="mt-6 flex h-12 items-center justify-center rounded-full bg-sunken text-[14px] font-medium text-ink-soft">Included on your account</p>
            ) : (
              <Button
                className="mt-6 h-12 w-full"
                variant={offer.highlight ? "primary" : "secondary"}
                loading={busy === offer.id}
                disabled={Boolean(busy) && busy !== offer.id}
                onClick={() => onChoose(offer.id)}
              >
                {label}
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function BillingAssurance() {
  return (
    <div className="mt-6 grid gap-3 rounded-[20px] border border-line bg-canvas px-4 py-4 text-[13px] leading-relaxed text-muted sm:grid-cols-3">
      <p className="flex gap-2">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-accent" />
        <span>Card details stay with Stripe. Simply Fit never sees the number.</span>
      </p>
      <p>Cancel in the billing portal. You keep a paid plan through the period you already paid for.</p>
      <p>Free is the base plan. Paid is $12 a month. Unlimited is $29 a month.</p>
    </div>
  );
}

export async function startPlan(plan: AccountTier, next: string) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan, next }),
  });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !data?.url) throw new Error(data?.error || "Couldn't open billing.");
  window.location.assign(data.url);
}

export async function startPaidCheckout(plan: PaidPlan, next: string) {
  return startPlan(plan, next);
}

export async function openBillingPortal() {
  const res = await fetch("/api/billing/portal", { method: "POST" });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !data?.url) throw new Error(data?.error || "Couldn't open the billing portal.");
  window.location.assign(data.url);
}
