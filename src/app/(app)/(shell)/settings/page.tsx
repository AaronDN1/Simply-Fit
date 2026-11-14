"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Apple, ArrowRight, Download, LogOut, Smartphone } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Toggle, UnitInput } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { deleteAccount, linkGoogle, linkedProviders, signOut, updateEmail, updatePassword } from "@/lib/auth";
import { detectDevice, nativeBridge, PLATFORM_LABEL, type HealthPlatform } from "@/lib/health";
import { LegalLinks } from "@/components/legal/document";
import { AI_OFF_COPY, AI_ON_COPY } from "@/lib/legal";
import { buildPlan } from "@/lib/plan";
import { displayWeight, inputWeightToKg } from "@/lib/units";
import type { Settings } from "@/lib/types";
import { addDays, cn, todayISO, uid } from "@/lib/utils";

const DIETS = ["Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "Gluten-free", "Dairy-free", "Lower carb"];

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 grid gap-3 border-t border-line py-7 first:border-0 first:pt-0 md:grid-cols-[220px_1fr] md:gap-8">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data, mode, updateProfile, clearData, loadDemoData, saveDaily, saveCardio } = useStore();
  const { profile } = data;
  const settings = profile.settings;
  const [name, setName] = useState(profile.displayName);
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const [goalWeight, setGoalWeight] = useState<number | "">(profile.intake?.goalWeightKg ? displayWeight(profile.intake.goalWeightKg, settings.units) : "");
  const [allergies, setAllergies] = useState(profile.intake?.allergies ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [healthHelp, setHealthHelp] = useState<HealthPlatform | null>(null);
  const [nativePlatform, setNativePlatform] = useState<HealthPlatform | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    linkedProviders().then(setProviders);
    setNativePlatform(nativeBridge()?.platform ?? null);
  }, []);

  async function run(key: string, fn: () => Promise<unknown>, msg: string) {
    setBusy(key);
    try {
      await fn();
      toast(msg);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  }

  const setSettings = (patch: Partial<Settings>) => updateProfile((p) => ({ settings: { ...p.settings, ...patch } }));

  function setUnits(units: Settings["units"]) {
    updateProfile((p) => ({ settings: { ...p.settings, units }, plan: p.intake && p.plan ? buildPlan(p.intake, p.plan.levers, { units }) : p.plan }));
    if (goalWeight !== "" && profile.intake?.goalWeightKg) setGoalWeight(displayWeight(profile.intake.goalWeightKg, units));
  }

  async function connectHealth(platform: HealthPlatform) {
    const bridge = nativeBridge();
    if (!bridge || bridge.platform !== platform) return setHealthHelp(platform);
    await run(
      `health-${platform}`,
      async () => {
        const ok = await bridge.requestAuthorization(["steps", "sleep", "weight", "workouts"]);
        if (!ok) throw new Error("Permission wasn't granted. You can change this in your phone's settings.");
        const { days, workouts } = await bridge.read({ start: addDays(todayISO(), -30), end: todayISO() });
        for (const d of days) await saveDaily(d.date, { ...(d.steps != null ? { steps: d.steps, stepsSource: platform } : {}), ...(d.sleepHours != null ? { sleepHours: d.sleepHours } : {}), ...(d.weightKg != null ? { weightKg: d.weightKg } : {}) });
        for (const w of workouts) await saveCardio({ id: uid(), date: w.date, activity: w.activity, minutes: w.minutes, intensity: w.intensity, source: platform, createdAt: new Date().toISOString() });
        await setSettings({ health: { ...settings.health, [platform === "apple_health" ? "appleHealth" : "healthConnect"]: "connected", lastSyncAt: new Date().toISOString() } });
      },
      `${PLATFORM_LABEL[platform]} connected`
    );
  }

  function disconnectHealth(platform: HealthPlatform) {
    run(`health-${platform}`, () => setSettings({ health: { ...settings.health, [platform === "apple_health" ? "appleHealth" : "healthConnect"]: "not_connected" } }), `${PLATFORM_LABEL[platform]} disconnected`);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simply-fit-export-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Export downloaded");
  }

  const intake = profile.intake;

  return (
    <div>
      <PageHeader title="Settings" />
      <Card className="p-5 sm:p-8">
        <Section title="Profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== profile.displayName && run("name", () => updateProfile({ displayName: name.trim() }), "Name updated")} />
            </Field>
          </div>
          <Link href="/onboarding" className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:underline">
            Update age, height, weight, and training details <ArrowRight className="size-3.5" />
          </Link>
        </Section>

        <Section title="Account" description="Email, password, and sign-in methods.">
          <div className="space-y-4">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  "email",
                  async () => {
                    const r = await updateEmail(email.trim());
                    if (!r.needsConfirmation) await updateProfile({ email: email.trim() });
                  },
                  mode === "supabase" ? "Check both inboxes to confirm the change" : "Email updated"
                );
              }}
            >
              <Field label="Email" className="flex-1">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Button type="submit" variant="secondary" className="h-11" disabled={email.trim() === profile.email} loading={busy === "email"}>
                Update
              </Button>
            </form>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (password.length < 8) return toast("Use at least 8 characters", "error");
                run("pw", async () => {
                  await updatePassword(password);
                  setPassword("");
                }, "Password changed");
              }}
            >
              <Field label="New password" className="flex-1">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
              </Field>
              <Button type="submit" variant="secondary" className="h-11" disabled={!password} loading={busy === "pw"}>
                Change
              </Button>
            </form>
            <div className="rounded-2xl border border-line">
              {[
                { id: "email", label: "Email and password" },
                { id: "google", label: "Google" },
              ].map((p) => {
                const on = providers.includes(p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0">
                    <span className="text-[14px]">{p.label}</span>
                    {on ? (
                      <Badge tone="accent">Connected</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => run("google", linkGoogle, "Redirecting to Google…")} disabled={mode === "demo"}>
                        Connect
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              variant="ghost"
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </Section>

        <Section id="health" title="Health data" description="Steps, sleep, workouts, and weight.">
          {nativePlatform ? (
          <div className="space-y-2">
            {(["apple_health", "health_connect"] as HealthPlatform[]).map((p) => {
              const status = p === "apple_health" ? settings.health.appleHealth : settings.health.healthConnect;
              return (
                <div key={p} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-sunken text-ink-soft">{p === "apple_health" ? <Apple className="size-4" /> : <Smartphone className="size-4" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">{PLATFORM_LABEL[p]}</span>
                    <span className="block text-[12px] text-muted">
                      {status === "connected"
                        ? `Connected${settings.health.lastSyncAt ? ` · last sync ${new Date(settings.health.lastSyncAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}`
                        : p === "apple_health"
                          ? "iPhone and Apple Watch"
                          : "Android, Samsung Health, Fitbit, and more"}
                    </span>
                  </span>
                  {status === "connected" ? (
                    <Button size="sm" variant="ghost" onClick={() => disconnectHealth(p)}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => connectHealth(p)} loading={busy === `health-${p}`}>
                      Connect
                    </Button>
                  )}
                </div>
              );
            })}
            <p className="pt-1 text-[12px] text-muted">You choose which data types to share from this phone. Anything you don't share can still be typed in.</p>
          </div>
          ) : (
            <p className="text-[14px] leading-relaxed text-ink-soft">
              This browser can't read Apple Health or Health Connect, and Simply Fit doesn't pull data from a watch or scale in the background. Log steps, sleep, cardio, and weight yourself. A future phone app will be able to sync them after you allow it.
            </p>
          )}
        </Section>

        <Section title="Units">
          <div className="flex flex-wrap gap-3">
            <Segmented value={settings.units.weight} onChange={(w) => setUnits({ ...settings.units, weight: w })} options={[{ value: "lb", label: "Pounds" }, { value: "kg", label: "Kilograms" }]} />
            <Segmented value={settings.units.height} onChange={(h) => setUnits({ ...settings.units, height: h })} options={[{ value: "imperial", label: "Feet / inches" }, { value: "metric", label: "Centimeters" }]} />
          </div>
        </Section>

        <Section title="Dietary preferences" description="Included with cloud AI estimates so suggestions fit how you eat.">
          <div className="flex flex-wrap gap-2">
            {DIETS.map((x) => {
              const on = intake?.dietaryPreferences.includes(x);
              return (
                <button
                  key={x}
                  onClick={() =>
                    intake &&
                    updateProfile({ intake: { ...intake, dietaryPreferences: on ? intake.dietaryPreferences.filter((y) => y !== x) : [...intake.dietaryPreferences, x] } })
                  }
                  className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", on ? "border-accent bg-accent-tint text-accent-strong" : "border-line bg-surface text-ink-soft hover:border-line-strong")}
                >
                  {x}
                </button>
              );
            })}
          </div>
          <Field label="Allergies or foods you avoid" className="mt-4">
            <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} onBlur={() => intake && allergies !== intake.allergies && run("allergies", () => updateProfile({ intake: { ...intake, allergies } }), "Saved")} />
          </Field>
        </Section>

        <Section title="Goals and plan">
          <div className="space-y-4">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!intake) return;
                run("goal", () => updateProfile({ intake: { ...intake, goalWeightKg: goalWeight === "" ? null : inputWeightToKg(goalWeight, settings.units) } }), "Goal weight saved");
              }}
            >
              <Field label="Goal weight" hint="Optional" className="max-w-[220px] flex-1">
                <UnitInput value={goalWeight} onChange={setGoalWeight} unit={settings.units.weight} />
              </Field>
              <Button type="submit" variant="secondary" className="mb-[22px] h-11" loading={busy === "goal"}>
                Save
              </Button>
            </form>
            <div className="flex flex-wrap gap-2">
              <Link href="/plan" className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium hover:border-line-strong">
                Adjust my plan
              </Link>
              <Link href="/onboarding" className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium hover:border-line-strong">
                Change my goal
              </Link>
            </div>
          </div>
        </Section>

        <Section title="Privacy" description="Your account data is stored for your plan. It is not sold.">
          <div className="divide-y divide-line">
            <Toggle
              label="Use cloud AI for meals and workouts"
              description={
                mode === "demo"
                  ? "This browser demo never sends data to OpenAI. In the hosted app, this sends meal text, photos, and voice notes, plus diet preferences and allergies."
                  : settings.privacy.aiUsesHistory
                    ? AI_ON_COPY
                    : AI_OFF_COPY
              }
              checked={settings.privacy.aiUsesHistory}
              onChange={(v) => setSettings({ privacy: { ...settings.privacy, aiUsesHistory: v } })}
            />
          </div>
          <LegalLinks className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted" />
        </Section>

        <Section title="Your data">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportData}>
              <Download className="size-4" /> Export all data
            </Button>
            <Button variant="secondary" onClick={() => setConfirmClear(true)}>
              Clear tracked data
            </Button>
            {mode === "demo" && (
              <Button variant="quiet" onClick={() => run("demo", loadDemoData, "Sample data loaded")} loading={busy === "demo"}>
                Load sample data
              </Button>
            )}
          </div>
          <div className="mt-6 rounded-2xl border border-clay/30 bg-clay-soft/50 p-4">
            <p className="text-[14px] font-medium text-clay">Delete account</p>
            <p className="mt-1 text-[13px] text-ink-soft">Permanently removes your account and all of your data. This can't be undone.</p>
            <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmDelete(true)}>
              Delete my account
            </Button>
          </div>
        </Section>
      </Card>

      <ConfirmSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear tracked data?"
        body="This removes all logged meals, workouts, cardio, steps, sleep, and weight. Your account, plan, and split stay."
        confirmLabel="Clear data"
        onConfirm={() => run("clear", clearData, "Tracked data cleared").then(() => setConfirmClear(false))}
        loading={busy === "clear"}
      />
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        body="Type DELETE to confirm. Your account and every piece of data will be permanently removed."
        confirmLabel="Delete permanently"
        requireText="DELETE"
        onConfirm={() =>
          run("delete", async () => {
            await deleteAccount();
            router.replace("/");
          }, "Account deleted")
        }
        loading={busy === "delete"}
      />
      <Sheet open={!!healthHelp} onClose={() => setHealthHelp(null)} title={`Connect ${healthHelp ? PLATFORM_LABEL[healthHelp] : ""}`}>
        <HealthHelp platform={healthHelp} />
      </Sheet>
    </div>
  );
}

function HealthHelp({ platform }: { platform: HealthPlatform | null }) {
  const device = detectDevice();
  if (!platform) return null;
  const apple = platform === "apple_health";
  const onRightDevice = (apple && device === "ios") || (!apple && device === "android");
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-ink-soft">
      <p>
        {PLATFORM_LABEL[platform]} data lives on your {apple ? "iPhone" : "Android phone"}, so it has to be shared from there — web browsers can't read it directly.
      </p>
      <ol className="space-y-2.5">
        <li className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-strong">1</span>
          {onRightDevice ? "Install the Simply Fit app on this phone and sign in with the same account." : `On your ${apple ? "iPhone" : "Android phone"}, install the Simply Fit app and sign in with the same account.`}
        </li>
        <li className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-strong">2</span>
          Go to Settings → Health data → Connect, and choose which data types to share (steps, sleep, workouts, weight).
        </li>
        <li className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-strong">3</span>
          New data syncs in the background and appears here automatically.
        </li>
      </ol>
      <p className="rounded-xl bg-canvas px-3.5 py-2.5 text-[13px] text-muted">Until then, you can log steps, sleep, cardio, and weight manually from the Activity page.</p>
    </div>
  );
}

function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  loading,
  requireText,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading: boolean;
  requireText?: string;
}) {
  const [text, setText] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-[14px] text-ink-soft">{body}</p>
      {requireText && <Input className="mt-4" value={text} onChange={(e) => setText(e.target.value)} placeholder={requireText} aria-label={`Type ${requireText}`} />}
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" className="flex-1" onClick={onConfirm} loading={loading} disabled={!!requireText && text !== requireText}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
