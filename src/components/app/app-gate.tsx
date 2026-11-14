"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { Logo, LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LegalLinks } from "@/components/legal/document";
import { hasAcceptedLegal, LEGAL_ACCEPT_KEY, LEGAL_VERSION } from "@/lib/legal";

/** Keeps signed-out users out, records legal acceptance, and sends new accounts through onboarding. */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { status, data, error, reload, updateProfile } = useStore();
  const router = useRouter();
  const path = usePathname();
  const onboarded = Boolean(data.profile.onboardedAt && data.profile.plan);
  const onOnboarding = path.startsWith("/onboarding");
  const accepted = hasAcceptedLegal(data.profile.settings.legal);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  const writing = useRef(false);

  useEffect(() => setMounted(true), []);

  const sessionAccepted = mounted && window.sessionStorage.getItem(LEGAL_ACCEPT_KEY) === LEGAL_VERSION;

  useEffect(() => {
    if (status === "signed_out") router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (status === "ready" && accepted && !onboarded && !onOnboarding) router.replace("/onboarding");
  }, [status, accepted, onboarded, onOnboarding, path, router]);

  useEffect(() => {
    if (status !== "ready" || accepted || !sessionAccepted || writing.current) return;
    writing.current = true;
    updateProfile((p) => ({
      settings: { ...p.settings, legal: { acceptedAt: new Date().toISOString(), version: LEGAL_VERSION } },
    })).catch(() => {
      writing.current = false;
      setLegalError("We couldn't save your agreement. Please try again.");
    });
  }, [status, accepted, sessionAccepted, updateProfile]);

  async function accept() {
    setLegalError(null);
    setSaving(true);
    sessionStorage.setItem(LEGAL_ACCEPT_KEY, LEGAL_VERSION);
    try {
      await updateProfile((p) => ({
        settings: { ...p.settings, legal: { acceptedAt: new Date().toISOString(), version: LEGAL_VERSION } },
      }));
    } catch (e) {
      setLegalError(e instanceof Error ? e.message : "We couldn't save your agreement.");
    } finally {
      setSaving(false);
    }
  }

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

  const showLegal = status === "ready" && mounted && !accepted && (!sessionAccepted || Boolean(legalError));
  const ready = status === "ready" && accepted && (onboarded || onOnboarding);
  if (showLegal) return <LegalGate onAccept={accept} saving={saving} error={legalError} />;
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

function LegalGate({ onAccept, saving, error }: { onAccept: () => void; saving: boolean; error: string | null }) {
  return (
    <div className="grid min-h-[100svh] place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <Logo href="/" />
        <h1 className="mt-8 font-display text-[36px] leading-[1.05] tracking-tight">Before you continue</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Simply Fit stores your plan and logs. When cloud AI is on, meal text, photos, and voice notes are sent to OpenAI. Please read these before using the app. You need to be 16 or older.
        </p>
        <LegalLinks className="mt-5 flex flex-col gap-2 text-[15px] font-medium text-ink" />
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          The <Link href="/medical" className="underline-offset-4 hover:underline">medical disclaimer</Link> explains that this is general guidance, not medical care.
        </p>
        {error && <p className="mt-4 text-[13px] text-clay">{error}</p>}
        <Button className="mt-6 w-full" size="lg" onClick={onAccept} loading={saving}>
          I agree, and I'm 16 or older
        </Button>
      </div>
    </div>
  );
}
