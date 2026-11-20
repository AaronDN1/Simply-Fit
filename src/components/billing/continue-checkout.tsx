"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { authMode, getSessionUser } from "@/lib/auth";
import { startPlan } from "@/components/billing/plan-cards";
import type { PaidPlan } from "@/lib/billing";

export function ContinueCheckout() {
  const params = useSearchParams();
  const requested = params.get("plan");
  const plan: PaidPlan | null = requested === "paid" || requested === "unlimited" ? requested : null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!plan || authMode === "demo") {
        window.location.assign("/onboarding");
        return;
      }
      const session = await getSessionUser();
      if (!session) {
        window.location.assign(`/signup?plan=${plan}`);
        return;
      }
      try {
        await startPlan(plan, "/onboarding");
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Couldn't open checkout.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [plan]);

  return (
    <div className="grid min-h-[100svh] place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <Logo />
        <h1 className="mt-8 font-display text-[36px] leading-tight">Opening secure checkout</h1>
        <p className="mt-2 text-[15px] text-muted">
          {error ?? "Your account is ready. Stripe is next, and the card stays there."}
        </p>
      </div>
    </div>
  );
}
