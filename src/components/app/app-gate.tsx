"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useStore } from "@/lib/store";
import { Logo, LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LegalAcceptFields, SupportEmail } from "@/components/legal/document";
import { ImpersonationBar } from "@/components/app/impersonation-bar";
import { hasAcceptedLegal, LEGAL_ACCEPT_KEY, LEGAL_VERSION } from "@/lib/legal";
import { isAdminEmail, readAccess } from "@/lib/admin";
import { consumeAdminReturn } from "@/lib/impersonation";
import { signOut } from "@/lib/auth";

/** Keeps signed-out users out, records legal acceptance, and sends new accounts through onboarding. */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { status, data, error, reload, updateProfile, actor, impersonating } = useStore();
  const router = useRouter();
  const path = usePathname();
  const onboarded = Boolean(data.profile.onboardedAt && data.profile.plan);
  const onOnboarding = path.startsWith("/onboarding");
  const adminRoute = path.startsWith("/admin");
  const actorIsAdmin = isAdminEmail(actor?.email);
  const disabled = Boolean(readAccess(data.profile.settings).disabledAt);
  const accepted = hasAcceptedLegal(data.profile.settings.legal);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);
  const writing = useRef(false);

  useEffect(() => setMounted(true), []);

  const sessionAccepted = mounted && window.sessionStorage.getItem(LEGAL_ACCEPT_KEY) === LEGAL_VERSION;

  useEffect(() => {
    if (status === "signed_out") {
      const login = `/login?next=${encodeURIComponent(path)}`;
      if (window.location.pathname !== "/login") window.location.assign(login);
      return;
    }
    else if (status === "ready" && accepted && !onboarded && !onOnboarding && !(adminRoute && actorIsAdmin) && !disabled) {
      if (actorIsAdmin && consumeAdminReturn()) router.replace("/admin");
      else router.replace("/onboarding");
    }
  }, [status, accepted, onboarded, onOnboarding, adminRoute, actorIsAdmin, disabled, path, router]);

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

  const showLegal = status === "ready" && mounted && !impersonating && !accepted && (!sessionAccepted || Boolean(legalError));
  const ready = status === "ready" && (impersonating || accepted) && (onboarded || onOnboarding || (adminRoute && actorIsAdmin));
  if (status === "ready" && disabled && !impersonating) {
    return (
      <div className="grid min-h-[100svh] place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-[36px] leading-tight">This account is disabled</h1>
          <p className="mt-2 text-[15px] text-muted">Simply Fit access for this account has been turned off.</p>
          <Button
            className="mt-6"
            variant="secondary"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }
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
  return (
    <>
      {impersonating && <ImpersonationBar />}
      <div className={impersonating ? "pt-12" : undefined}>{children}</div>
    </>
  );
}

function LegalGate({ onAccept, saving, error }: { onAccept: () => void; saving: boolean; error: string | null }) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const both = terms && privacy;
  return (
    <div className="grid min-h-[100svh] place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <Logo href="/" />
        <h1 className="mt-8 font-display text-[36px] leading-[1.05] tracking-tight">Before you continue</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          The Terms of Service and the Privacy Policy are a contract. Both boxes are required. Simply Fit may suspend or ban an account at any time. The app stores your plan and logs, and cloud AI sends meal text, photos, and voice notes to OpenAI when that setting is on.
        </p>
        <LegalAcceptFields className="mt-5" terms={terms} privacy={privacy} onTerms={setTerms} onPrivacy={setPrivacy} />
        <p className="mt-4 text-[13px] text-muted">
          Questions: <SupportEmail />
        </p>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          The <Link href="/medical" className="underline-offset-4 hover:underline">medical disclaimer</Link> is part of the terms. It explains that this is general guidance, not medical care.
        </p>
        {error && <p className="mt-4 text-[13px] text-clay">{error}</p>}
        <Button className="mt-6 w-full" size="lg" onClick={onAccept} loading={saving} disabled={!both}>
          I agree
        </Button>
      </div>
    </div>
  );
}
