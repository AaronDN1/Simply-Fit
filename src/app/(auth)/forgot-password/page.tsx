"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authMode, sendPasswordReset } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset link.");
    } finally {
      setLoading(false);
    }
  }

  if (sent && authMode === "demo") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-[34px] leading-tight">Set a new password</h1>
        <p className="mt-2 text-[15px] text-muted">In local demo mode there's no email delivery, so you can reset it right here.</p>
        <ButtonLink href={`/reset-password?email=${encodeURIComponent(email)}`} size="lg" className="mt-6 w-full">
          Continue
        </ButtonLink>
      </motion.div>
    );
  }

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <MailCheck className="size-5" />
        </div>
        <h1 className="font-display text-[34px] leading-tight">Check your email</h1>
        <p className="mt-2 text-[15px] text-muted">
          If an account exists for <span className="text-ink">{email}</span>, a reset link is on its way. It expires in an hour.
        </p>
        <ButtonLink href="/login" variant="secondary" className="mt-6">
          Back to sign in
        </ButtonLink>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Sign in
      </Link>
      <h1 className="font-display text-[38px] leading-[1.05] tracking-tight">Reset your password</h1>
      <p className="mt-2 text-[15px] text-muted">Enter your email and we'll send you a link to choose a new one.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        {error && <p className="rounded-xl bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
    </motion.div>
  );
}
