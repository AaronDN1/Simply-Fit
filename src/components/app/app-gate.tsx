"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";

/** Keeps signed-out users out and makes sure onboarding happens before the dashboard. */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { status, data, error, reload } = useStore();
  const router = useRouter();
  const path = usePathname();
  const onboarded = Boolean(data.profile.onboardedAt && data.profile.plan);
  const onOnboarding = path.startsWith("/onboarding");

  useEffect(() => {
    if (status === "signed_out") router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (status === "ready" && !onboarded && !onOnboarding) router.replace("/onboarding");
  }, [status, onboarded, onOnboarding, path, router]);

  if (status === "error") {
    return (
      <div className="grid min-h-[100svh] place-items-center px-6 text-center">
        <div>
          <p className="font-medium">We couldn't load your data.</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <Button className="mt-4" variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const ready = status === "ready" && (onboarded || onOnboarding);
  if (!ready) {
    return (
      <div className="grid min-h-[100svh] place-items-center">
        <motion.div animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <LogoMark className="size-9" />
        </motion.div>
      </div>
    );
  }
  return <>{children}</>;
}
