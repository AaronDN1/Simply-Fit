"use client";

import { Suspense, useEffect, useRef, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Dumbbell, Footprints, Info, Moon, PencilLine, RotateCcw, Sparkles, Timer } from "lucide-react";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/field";
import { AnimatedNumber } from "@/components/ui/data";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { aggressiveGainMessage, aggressiveLossMessage, applyMacroTargets, buildPlan, defaultLevers, exceedsRecommendedGain, exceedsRecommendedLoss, goalDirection, GOAL_LABEL, MAX_CALORIES, MIN_CALORIES, MacroTargets, rateBounds, rateForCalories } from "@/lib/plan";
import { displayWeight, formatRate, lbToKg } from "@/lib/units";
import { recommendedSplit } from "@/lib/workouts";
import { MacroEditor } from "@/components/app/macro-editor";
import type { Plan, PlanLevers, Settings } from "@/lib/types";
import { clamp, cn, round } from "@/lib/utils";

function PlanView() {
  const params = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const router = useRouter();
  const toast = useToast();
  const { data, updateProfile } = useStore();
  const { intake, plan, split, settings } = data.profile;
  const units = settings.units;
  const [draft, setDraft] = useState<PlanLevers>(plan!.levers);
  const [macroOverride, setMacroOverride] = useState<MacroTargets | null>(() =>
    plan?.macrosCustomized ? { proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG } : null
  );
  const [saving, setSaving] = useState(false);
  const [assumptions, setAssumptions] = useState<string[]>([]);

  useEffect(() => {
    if (!welcome) return;
    const raw = sessionStorage.getItem("simplyfit:assumptions");
    if (!raw) return;
    sessionStorage.removeItem("simplyfit:assumptions");
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setAssumptions(parsed.filter((item) => typeof item === "string"));
    } catch {
      /* Ignore a malformed note from an older session. */
    }
  }, [welcome]);

  const basePreview = useMemo(() => buildPlan(intake!, draft, { units }), [intake, draft, units]);
  const preview = useMemo(
    () => (macroOverride ? applyMacroTargets(intake!, basePreview, macroOverride, units) : basePreview),
    [intake, basePreview, macroOverride, units]
  );
  const leversDirty = JSON.stringify(draft) !== JSON.stringify(plan!.levers) || macroOverride !== null;

  if (!intake || !plan) return null;

  const bounds = rateBounds(intake);
  const calMin = MIN_CALORIES;
  const calMax = MAX_CALORIES;
  const paceMin = Math.round(displayWeight(bounds.maxLoss, units, 2) * 100);
  const paceMax = Math.round(displayWeight(bounds.maxGain, units, 2) * 100);
  const paceThumb = clamp(Math.round(displayWeight(preview.levers.weeklyRateKg, units, 2) * 100), paceMin, paceMax);
  const fastLoss = exceedsRecommendedLoss(preview.levers.weeklyRateKg, units);
  const fastGain = exceedsRecommendedGain(preview.levers.weeklyRateKg, intake, units);
  const paceNote = fastLoss ? aggressiveLossMessage(units) : fastGain ? aggressiveGainMessage(intake, units) : null;
  const targetsDirty =
    preview.calorieTarget !== plan.calorieTarget ||
    preview.proteinG !== plan.proteinG ||
    preview.carbsG !== plan.carbsG ||
    preview.fatG !== plan.fatG ||
    Math.abs(preview.levers.weeklyRateKg - plan.levers.weeklyRateKg) > 0.001;
  const dirty = leversDirty || targetsDirty;

  const setActivity = (patch: Partial<Pick<PlanLevers, "stepTarget" | "cardioMinutesPerWeek">>) => {
    const known = intake;
    const calories = preview.calorieTarget;
    setMacroOverride(null);
    setDraft((d) => {
      const next = { ...d, ...patch };
      return { ...next, weeklyRateKg: Math.round(rateForCalories(known, next, calories) * 1000) / 1000 };
    });
  };

  async function save() {
    setSaving(true);
    try {
      const daysChanged = preview.levers.liftingDays !== plan!.levers.liftingDays;
      const regenerate = daysChanged && (!split || split.source === "recommended");
      await updateProfile({ plan: preview, split: regenerate ? recommendedSplit(intake!, preview.levers.liftingDays) : split });
      setMacroOverride(null);
      toast(regenerate ? "Plan saved · training week updated" : "Plan saved");
      if (daysChanged && !regenerate) toast("Your custom split wasn't changed — adjust it in Training.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveMacros(next: Plan) {
    await updateProfile({ plan: next });
    setDraft(next!.levers);
    setMacroOverride({ proteinG: next.proteinG, carbsG: next.carbsG, fatG: next.fatG });
    toast("Macro targets saved");
  }

  const shown = preview;

  return (
    <>
      <AnimatePresence>
        {welcome && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] bg-brand p-5 text-chalk sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-medium text-chalk-dim">
                <Sparkles className="size-4" /> Your plan is ready
              </p>
              <p className="mt-1 text-[15px] text-chalk">Here's what we recommend and why. Adjust anything that doesn't fit — then start your day.</p>
              {assumptions.length > 0 && (
                <ul className="mt-3 max-w-lg list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-chalk-dim">
                  {assumptions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
            <Button className="bg-chalk text-iron hover:bg-white" onClick={() => router.push("/today")}>
              Start today <ArrowRight className="size-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader
        eyebrow={`${GOAL_LABEL[intake.goal]}${intake.goal === "custom" && intake.customGoal ? ` · ${intake.customGoal}` : ""}`}
        title="My plan"
        description="Your targets, the reasoning behind them, and the levers you can pull."
        action={
          <Link href="/onboarding" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium hover:border-line-strong">
            <PencilLine className="size-4" /> Update my answers
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-muted">Daily calories</p>
                <p className="mt-1 font-display text-[64px] leading-none">
                  <AnimatedNumber value={shown.calorieTarget} />
                </p>
                <p className="mt-2 text-sm text-muted">
                  Maintenance ≈ <span className="tabular text-ink-soft">{shown.maintenanceCalories.toLocaleString()}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent" className="px-3 py-1 text-[13px]">
                  {formatRate(shown.levers.weeklyRateKg, units)}
                </Badge>
                <MacroEditor plan={preview} intake={intake} units={units} onApply={saveMacros} />
              </div>
            </div>
            <PaceNote message={paceNote} />
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: "Protein", g: shown.proteinG, color: "bg-accent" },
                { label: "Carbs", g: shown.carbsG, color: "bg-honey" },
                { label: "Fat", g: shown.fatG, color: "bg-clay" },
              ].map((m) => (
                <div key={m.label} className="rounded-2xl bg-canvas px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[12px] text-muted">
                    <span className={cn("size-1.5 rounded-full", m.color)} />
                    {m.label}
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular">
                    <AnimatedNumber value={m.g} />
                    <span className="ml-0.5 text-sm font-normal text-muted">g</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Target icon={<Dumbbell className="size-4" />} label="Lifting" value={`${shown.levers.liftingDays} days/wk`} />
              <Target icon={<Timer className="size-4" />} label="Cardio" value={`${shown.levers.cardioMinutesPerWeek} min/wk`} />
              <Target icon={<Footprints className="size-4" />} label="Steps" value={shown.levers.stepTarget.toLocaleString()} />
              <Target icon={<Moon className="size-4" />} label="Sleep" value={`${shown.sleepTargetHours} h`} />
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <SectionTitle title="Why this plan" />
            <ul className="space-y-3">
              {shown.explanation.map((e, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {e}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-line pt-5">
              <SectionTitle title="Recovery" />
              <ul className="space-y-2.5">
                {shown.recovery.map((e, i) => (
                  <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-muted">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-faint" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-6 flex gap-2 rounded-2xl bg-sunken/70 px-4 py-3 text-[13px] leading-relaxed text-muted">
              <Info className="mt-0.5 size-4 shrink-0" />
              Estimates are a starting point, not medical advice. After 2–3 weeks your real weight trend tells us more than any formula — we'll suggest adjustments.
            </p>
          </Card>
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <Card className="p-5 sm:p-6">
            <SectionTitle
              title="Adjust your plan"
              description="Change what matters to you. We'll balance the rest."
              action={
                leversDirty ? (
                    <button onClick={() => { setMacroOverride(null); setDraft(plan.levers); }} className="flex items-center gap-1 text-[13px] text-muted hover:text-ink">
                    <RotateCcw className="size-3.5" /> Reset
                  </button>
                ) : (
                  <button onClick={() => { setMacroOverride(null); setDraft(defaultLevers(intake)); }} className="text-[13px] text-muted hover:text-ink">
                    Recommended
                  </button>
                )
              }
            />
            <div className="space-y-6">
              <Lever
                label="Calories"
                value={
                  <ClickToEdit
                    display={preview.calorieTarget.toLocaleString()}
                    editValue={String(preview.calorieTarget)}
                    suffix="kcal"
                    ariaLabel="Type daily calories"
                    onCommit={(raw) => {
                      const n = Number(raw);
                      if (!Number.isFinite(n)) return;
                      const c = clamp(round(n, 10), calMin, calMax);
                      setMacroOverride(null);
                      setDraft((d) => ({ ...d, weeklyRateKg: Math.round(rateForCalories(intake, d, c) * 1000) / 1000 }));
                    }}
                  />
                }
                left="Less food"
                right="More food"
                slider={
                  <Slider
                    ariaLabel="Calories"
                    min={calMin}
                    max={calMax}
                    step={50}
                    value={Math.min(calMax, Math.max(calMin, preview.calorieTarget))}
                    onChange={(c) => {
                      setMacroOverride(null);
                      setDraft((d) => ({ ...d, weeklyRateKg: Math.round(rateForCalories(intake, d, c) * 1000) / 1000 }));
                    }}
                  />
                }
              />
              <div>
                <Lever
                  label="Pace"
                  value={
                    <PaceEdit
                      kgPerWeek={preview.levers.weeklyRateKg}
                      units={units}
                      maxLossKg={bounds.maxLoss}
                      maxGainKg={bounds.maxGain}
                      fallbackSign={goalDirection(intake.goal) || -1}
                      onCommit={(kg) => {
                        setMacroOverride(null);
                        setDraft((d) => ({ ...d, weeklyRateKg: clamp(kg, bounds.maxLoss, bounds.maxGain) }));
                      }}
                    />
                  }
                  left="Lose faster"
                  right="Gain faster"
                  slider={
                    <Slider
                      ariaLabel="Weekly weight change"
                      min={paceMin}
                      max={paceMax}
                      step={5}
                      value={paceThumb}
                      onChange={(v) => {
                        setMacroOverride(null);
                        const kg = units.weight === "lb" ? lbToKg(v / 100) : v / 100;
                        setDraft((d) => ({ ...d, weeklyRateKg: clamp(kg, bounds.maxLoss, bounds.maxGain) }));
                      }}
                    />
                  }
                />
                <div className="lg:hidden">
                  <PaceNote message={paceNote} />
                </div>
              </div>
              <Lever
                label="Daily steps"
                value={
                  <ClickToEdit
                    display={draft.stepTarget.toLocaleString()}
                    editValue={String(draft.stepTarget)}
                    ariaLabel="Type daily steps"
                    onCommit={(raw) => {
                      const n = Number(raw);
                      if (!Number.isFinite(n)) return;
                      setActivity({ stepTarget: clamp(round(n, 500), 3000, 20000) });
                    }}
                  />
                }
                slider={<Slider ariaLabel="Daily steps" min={3000} max={20000} step={500} value={draft.stepTarget} onChange={(v) => setActivity({ stepTarget: v })} />}
              />
              <Lever
                label="Cardio per week"
                value={
                  <ClickToEdit
                    display={String(draft.cardioMinutesPerWeek)}
                    editValue={String(draft.cardioMinutesPerWeek)}
                    suffix="min"
                    ariaLabel="Type weekly cardio minutes"
                    onCommit={(raw) => {
                      const n = Number(raw);
                      if (!Number.isFinite(n)) return;
                      setActivity({ cardioMinutesPerWeek: clamp(round(n, 10), 0, 420) });
                    }}
                  />
                }
                slider={<Slider ariaLabel="Cardio minutes" min={0} max={420} step={10} value={draft.cardioMinutesPerWeek} onChange={(v) => setActivity({ cardioMinutesPerWeek: v })} />}
              />
              <Lever
                label="Training days"
                value={`${draft.liftingDays} / week`}
                slider={<Slider ariaLabel="Training days" min={0} max={7} step={1} value={draft.liftingDays} onChange={(v) => { setMacroOverride(null); setDraft((d) => ({ ...d, liftingDays: v })); }} />}
              />
            </div>

            <Button className="mt-6 w-full" size="lg" disabled={!dirty} loading={saving} onClick={save}>
              Save changes
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

function ClickToEdit({
  display,
  editValue,
  prefix,
  suffix,
  editPrefix,
  editSuffix,
  ariaLabel,
  onCommit,
}: {
  display: string;
  editValue: string;
  prefix?: string;
  suffix?: string;
  editPrefix?: string;
  editSuffix?: string;
  ariaLabel: string;
  onCommit: (raw: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(editValue);
  const skip = useRef(false);

  function open() {
    skip.current = false;
    setText(editValue);
    setEditing(true);
  }

  function commit(raw = text) {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const cleaned = raw.trim().replace(/,/g, "");
    if (cleaned !== editValue) onCommit(cleaned);
    setEditing(false);
  }

  const before = editing ? (editPrefix ?? prefix) : prefix;
  const after = editing ? (editSuffix ?? suffix) : suffix;

  return (
    <span className="inline-flex items-baseline gap-1">
      {before && <span>{before}</span>}
      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          aria-label={ariaLabel}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(e.currentTarget.value);
            } else if (e.key === "Escape") {
              e.preventDefault();
              skip.current = true;
              setEditing(false);
            }
          }}
          style={{ width: `${Math.max(3, text.length + 1)}ch` }}
          className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-right text-[14px] tabular text-ink outline-none focus:border-accent"
        />
      ) : (
        <button
          type="button"
          onClick={open}
          className="rounded-sm underline decoration-dotted decoration-faint/80 underline-offset-[3px] hover:text-ink hover:decoration-ink"
          aria-label={ariaLabel}
        >
          {display}
        </button>
      )}
      {after && <span>{after}</span>}
    </span>
  );
}

function PaceEdit({
  kgPerWeek,
  units,
  maxLossKg,
  maxGainKg,
  fallbackSign,
  onCommit,
}: {
  kgPerWeek: number;
  units: Settings["units"];
  maxLossKg: number;
  maxGainKg: number;
  fallbackSign: -1 | 1;
  onCommit: (kg: number) => void;
}) {
  const digits = units.weight === "lb" ? 1 : 2;
  const steady = Math.abs(displayWeight(kgPerWeek, units, digits)) < 0.05;
  const sign: -1 | 1 = kgPerWeek < 0 ? -1 : kgPerWeek > 0 ? 1 : fallbackSign;
  const amount = steady ? 0 : Math.abs(displayWeight(kgPerWeek, units, digits));
  const word = sign < 0 ? "Lose" : "Gain";
  const unitLabel = `${units.weight}/week`;
  const maxMagnitude = Math.abs(displayWeight(sign < 0 ? maxLossKg : maxGainKg, units, digits));

  return (
    <ClickToEdit
      display={steady ? "Hold steady" : String(amount)}
      editValue={String(amount)}
      prefix={steady ? undefined : word}
      suffix={steady ? undefined : unitLabel}
      editPrefix={word}
      editSuffix={unitLabel}
      ariaLabel="Type weekly weight change"
      onCommit={(raw) => {
        const n = Math.abs(Number(raw));
        if (!Number.isFinite(n)) return;
        const magnitude = clamp(n, 0, maxMagnitude);
        const kg = units.weight === "lb" ? lbToKg(magnitude) : magnitude;
        onCommit(sign < 0 ? -kg : kg);
      }}
    />
  );
}

function PaceNote({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <p className="mt-3 rounded-r-2xl border-l-4 border-accent bg-accent-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-accent-strong">
            {message}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Target({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-[15px] font-medium tabular">{value}</p>
    </div>
  );
}

function Lever({ label, value, slider, left, right }: { label: string; value: React.ReactNode; slider: React.ReactNode; left?: string; right?: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-medium">{label}</span>
        <span className="text-[14px] tabular text-ink-soft">{value}</span>
      </div>
      {slider}
      {left && (
        <div className="flex justify-between text-[11px] text-faint">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense>
      <PlanView />
    </Suspense>
  );
}
