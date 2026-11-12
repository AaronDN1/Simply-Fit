"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updatePassword } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those passwords don't match.");
    setLoading(true);
    setError(null);
    try {
      await updatePassword(password, params.get("email") ?? undefined);
      toast("Password updated");
      router.replace(params.get("email") ? "/login" : "/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="font-display text-[38px] leading-[1.05] tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-[15px] text-muted">Make it at least 8 characters.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="New password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </Field>
        <Field label="Confirm password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </Field>
        {error && <p className="rounded-xl bg-clay-soft px-3.5 py-2.5 text-[13px] text-clay">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
