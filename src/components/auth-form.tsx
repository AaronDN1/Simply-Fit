"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authMode, signInWithEmail, signInWithGoogle, signUpWithEmail, startDemoSession } from "@/lib/auth";
import { LegalAcceptFields } from "@/components/legal/document";
import { LEGAL_ACCEPT_KEY, LEGAL_VERSION } from "@/lib/legal";
import { buildDemoSnapshot } from "@/lib/data/seed";
import { readLocalSnapshot, writeLocalSnapshot } from "@/lib/data/local";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/today";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState<"email" | "google" | "demo" | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && (!agreedTerms || !agreedPrivacy)) return setError("Check both boxes. An account requires the Terms of Service and the Privacy Policy.");
    if (mode === "signup" && password.length < 8) return setError("Use at least 8 characters for your password.");
    setLoading("email");
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUpWithEmail(email.trim(), password, name.trim());
        sessionStorage.setItem(LEGAL_ACCEPT_KEY, LEGAL_VERSION);
        if (needsConfirmation) return setSent(true);
        router.replace("/onboarding");
      } else {
        await signInWithEmail(email.trim(), password, remember);
        router.replace(next);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  async function google() {
    setError(null);
    if (mode === "signup" && (!agreedTerms || !agreedPrivacy)) return setError("Check both boxes. An account requires the Terms of Service and the Privacy Policy.");
    if (mode === "signup") sessionStorage.setItem(LEGAL_ACCEPT_KEY, LEGAL_VERSION);
    setLoading("google");
    try {
      await signInWithGoogle(mode === "signup" ? "/onboarding" : next, remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start Google sign-in.");
      setLoading(null);
    }
  }

  async function demo() {
    setLoading("demo");
    const u = await startDemoSession();
    if (!readLocalSnapshot(u.id)?.profile.onboardedAt) writeLocalSnapshot(buildDemoSnapshot(u.id, u.email, u.name));
    router.replace("/today");
  }

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <MailCheck className="size-5" />
        </div>
        <h1 className="font-display text-[34px] leading-tight">Check your inbox</h1>
        <p className="mt-2 text-[15px] text-muted">
          We sent a confirmation link to <span className="text-ink">{email}</span>. Open it on this device to start building your plan.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <h1 className="font-display text-[38px] leading-[1.05] tracking-tight">{mode === "signup" ? "Build your plan" : "Welcome back"}</h1>
      <p className="mt-2 text-[15px] text-muted">{mode === "signup" ? "Create an account — it takes about three minutes to get your plan." : "Sign in to see what's on for today."}</p>

      {mode === "signup" && (
        <LegalAcceptFields
          className="mt-6"
          terms={agreedTerms}
          privacy={agreedPrivacy}
          onTerms={setAgreedTerms}
          onPrivacy={setAgreedPrivacy}
        />
      )}

      <Button variant="secondary" size="lg" className={mode === "signup" ? "mt-4 w-full" : "mt-7 w-full"} onClick={google} loading={loading === "google"}>
        <GoogleIcon /> {mode === "signup" ? "Sign up with Google" : "Continue with Google"}
      </Button>

      <div className="my-5 flex items-center gap-3 text-[12px] text-faint">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        {mode === "signup" && (
          <Field label="First name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Alex" />
          </Field>
        )}
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </Field>
        {mode === "signin" && (
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
              Remember me
            </label>
            <Link href="/forgot-password" className="text-[13px] text-muted underline-offset-4 hover:text-ink hover:underline">
              Forgot password?
            </Link>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading === "email"}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "signup" ? "Already have an account? " : "New to Simply Fit? "}
        <Link href={mode === "signup" ? "/login" : "/signup"} className="font-medium text-ink underline-offset-4 hover:underline">
          {mode === "signup" ? "Sign in" : "Create an account"}
        </Link>
      </p>

      {authMode === "demo" && (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong p-4">
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-medium text-ink">Local demo mode.</span> Supabase isn't configured, so accounts and data are stored in this browser only.
          </p>
          <Button variant="quiet" size="sm" className="mt-3" onClick={demo} loading={loading === "demo"}>
            Explore with sample data
          </Button>
        </div>
      )}
    </motion.div>
  );
}
