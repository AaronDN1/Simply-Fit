import { Suspense } from "react";
import { ContinueCheckout } from "@/components/billing/continue-checkout";

export default function ContinueBillingPage() {
  return (
    <Suspense>
      <ContinueCheckout />
    </Suspense>
  );
}
