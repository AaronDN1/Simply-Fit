"use client";

import { Suspense, useMemo, useState } from "react";
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
import { applyMacroTargets, buildPlan, calorieFloor, defaultLevers, explainTradeoff, GOAL_LABEL, maintenanceFrom, energyBreakdown, MacroTargets, rateBounds, rateForCalories } from "@/lib/plan";
import { displayWeight, formatRate } from "@/lib/units";
import { recommendedSplit } from "@/lib/workouts";
import { MacroEditor } from "@/components/app/macro-editor";
import type { Plan, PlanLevers } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  const basePreview = useMemo(() => buildPlan(intake!, draft, { units }), [intake, draft, units]);
  const preview = useMemo(
    () => (macroOverride ? applyMacroTargets(intake!, basePreview, macroOverride, units) : basePreview),
    [intake, basePreview, macroOverride, units]
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(plan!.levers) || macroOverride !== null;
  const tradeoffs = useMemo(() => (dirty ? explainTradeoff(intake!, plan!, preview, units) : []), [dirty, intake, plan, preview, units]);

  if (!intake || !plan) return null;

  const bounds = rateBounds(intake);
  const maintenance = maintenanceFrom(energyBreakdown(intake, draft));
  const floor = calorieFloor(intake);
  const calMin = Math.max(floor, Math.round((maintenance + (bounds.maxLoss * 7700) / 7) / 10) * 10);
  const calMax = Math.round((maintenance + (bounds.maxGain * 7700) / 7) / 10) * 10;

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
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] bg-accent-strong p-5 text-canvas sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-medium text-[#b9d3c5]">
                <Sparkles className="size-4" /> Your plan is ready
              </p>
              <p className="mt-1 text-[15px] text-[#e3eee7]">Here's what we recommend and why. Adjust anything that doesn't fit — then start your day.</p>
            </div>
            <Button className="bg-canvas text-ink hover:bg-white" onClick={() => router.push("/today")}>
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
                dirty ? (
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
                value={`${preview.calorieTarget.toLocaleString()} kcal`}
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
              <Lever
                label="Pace"
                value={formatRate(draft.weeklyRateKg, units)}
                left="Lose faster"
                right="Gain faster"
                slider={
                  <Slider
                    ariaLabel="Weekly weight change"
                    min={Math.round(displayWeight(bounds.maxLoss, units, 2) * 100)}
                    max={Math.round(displayWeight(bounds.maxGain, units, 2) * 100)}
                    step={5}
                    value={Math.round(displayWeight(draft.weeklyRateKg, units, 2) * 100)}
                    onChange={(v) => {
                      setMacroOverride(null);
                      setDraft((d) => ({ ...d, weeklyRateKg: units.weight === "lb" ? (v / 100) * 0.45359237 : v / 100 }));
                    }}
                  />
                }
              />
              <Lever
                label="Daily steps"
                value={draft.stepTarget.toLocaleString()}
                slider={<Slider ariaLabel="Daily steps" min={3000} max={20000} step={500} value={draft.stepTarget} onChange={(v) => { setMacroOverride(null); setDraft((d) => ({ ...d, stepTarget: v })); }} />}
              />
              <Lever
                label="Cardio per week"
                value={`${draft.cardioMinutesPerWeek} min`}
                slider={<Slider ariaLabel="Cardio minutes" min={0} max={420} step={10} value={draft.cardioMinutesPerWeek} onChange={(v) => { setMacroOverride(null); setDraft((d) => ({ ...d, cardioMinutesPerWeek: v })); }} />}
              />
              <Lever
                label="Training days"
                value={`${draft.liftingDays} / week`}
                slider={<Slider ariaLabel="Training days" min={0} max={7} step={1} value={draft.liftingDays} onChange={(v) => { setMacroOverride(null); setDraft((d) => ({ ...d, liftingDays: v })); }} />}
              />
            </div>

            <AnimatePresence initial={false}>
              {tradeoffs.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-6 space-y-2 rounded-2xl bg-accent-tint p-4">
                    <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-accent">The tradeoff</p>
                    {tradeoffs.map((t, i) => (
                      <motion.p key={t} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="text-[14px] leading-relaxed text-accent-strong">
                        {t}
                      </motion.p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button className="mt-6 w-full" size="lg" disabled={!dirty} loading={saving} onClick={save}>
              Save changes
            </Button>
          </Card>
        </div>
      </div>
    </>
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

function Lever({ label, value, slider, left, right }: { label: string; value: string; slider: React.ReactNode; left?: string; right?: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between">
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
