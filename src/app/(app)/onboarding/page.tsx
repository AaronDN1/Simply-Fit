"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CalendarDays, Dumbbell, HeartPulse, Leaf, Mountain, Scale, Sparkles, Target, Timer, TrendingDown, TrendingUp, Utensils, Zap } from "lucide-react";
import { Logo } from "@/components/logo";
import { DayScale, DietPicks, Instrument, InstrumentRow, MealRhythm, PaceCards, ScaleSlider } from "@/components/app/intake-ui";
import { Button } from "@/components/ui/button";
import { Choices, Field, Input, Segmented, Textarea } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { isAdminEmail } from "@/lib/admin";
import type { Goal, Intake, Plan, Priority, Settings } from "@/lib/types";
import { kgToLb, lbToKg } from "@/lib/units";
import { ageBlockMessage, isEligibleAge } from "@/lib/legal";
import { GOAL_LABEL, generatePlan, rateBounds } from "@/lib/plan";
import { recommendedSplit, EQUIPMENT_LABEL } from "@/lib/workouts";
import { useToast } from "@/components/ui/toast";

type Draft = Omit<Intake, "age" | "heightCm" | "weightKg"> & { age: number | ""; heightCm: number | ""; weightKg: number | "" };

const DEFAULT: Draft = {
  age: "",
  sex: "unspecified",
  heightCm: "",
  weightKg: "",
  goalWeightKg: null,
  experience: "intermediate",
  liftingDaysPerWeek: 3,
  liftingSessionMinutes: 60,
  cardioMinutesPerWeek: 60,
  averageSteps: 7000,
  sleepHours: 7.5,
  activityLevel: "light",
  equipment: "full_gym",
  trainingStyle: "general",
  dietaryPreferences: [],
  allergies: "",
  mealStructure: "three_plus_snacks",
  goal: "fat_loss",
  customGoal: "",
  weeklyRateKg: 0,
  priorities: [],
};

const STEPS = [
  { key: "goal", title: "What are you working toward?", sub: "Pick the one that matters most right now. You can change it anytime." },
  { key: "body", title: "A little about you", sub: "Used to estimate how much energy your body uses. Only age, height, and weight are needed." },
  { key: "training", title: "How do you train now?", sub: "Your real routine — not your ideal one. We'll build from here." },
  { key: "activity", title: "Activity and sleep", sub: "Rough numbers are fine. If you have a phone or watch, its averages are perfect." },
  { key: "food", title: "How do you like to eat?", sub: "So suggestions fit your life. Skip anything that doesn't apply." },
  { key: "pace", title: "Your pace and priorities", sub: "Tell us what matters so the plan feels doable, not punishing." },
] as const;

const GOALS: { value: Goal; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "fat_loss", label: "Lose fat", description: "Lean out while keeping strength", icon: <TrendingDown className="size-4" /> },
  { value: "muscle_gain", label: "Build muscle", description: "Gain size and strength steadily", icon: <TrendingUp className="size-4" /> },
  { value: "recomp", label: "Recomposition", description: "Lose fat and build muscle slowly", icon: <Scale className="size-4" /> },
  { value: "maintenance", label: "Maintain", description: "Hold weight, keep habits", icon: <Leaf className="size-4" /> },
  { value: "endurance", label: "Endurance", description: "Run, ride, or swim better", icon: <Mountain className="size-4" /> },
  { value: "general_health", label: "General health", description: "Feel better and move more", icon: <HeartPulse className="size-4" /> },
  { value: "custom", label: "Something else", description: "Describe it in your words", icon: <Target className="size-4" /> },
];

const DIETS = ["Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "Gluten-free", "Dairy-free", "Lower carb"];

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const { data, updateProfile, actor } = useStore();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [d, setD] = useState<Draft>(() => (data.profile.intake ? { ...DEFAULT, ...data.profile.intake } : DEFAULT));
  const [units, setUnits] = useState<Settings["units"]>(data.profile.settings.units);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [readyPlan, setReadyPlan] = useState<Plan | null>(null);
  const buildRef = useRef<{ key: string; promise: Promise<Plan>; done?: Plan } | null>(null);
  const buildQueue = useRef(Promise.resolve());

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function validate(draft: Draft) {
    if (step === 1) {
      if (draft.age !== "" && draft.age < 16) return "Simply Fit is for people 16 and older, so we can't build a plan or store health data for this age.";
      if (!draft.age || draft.age > 90) return "Enter an age between 16 and 90.";
      if (!draft.heightCm || draft.heightCm < 120 || draft.heightCm > 230) return "Enter your height.";
      if (!draft.weightKg || draft.weightKg < 35 || draft.weightKg > 300) return "Enter your current weight.";
    }
    if (step === 0 && draft.goal === "custom" && !draft.customGoal.trim()) return "Tell us a little about your goal, or pick one above.";
    return null;
  }

  function go(delta: number, skip = false) {
    const draft = step === 1 && delta > 0 && !skip ? commitBody(d) : d;
    if (draft !== d) setD(draft);
    if (delta > 0 && !skip) {
      const e = validate(draft);
      if (e) return setError(e);
      setSkipped((current) => {
        const next = new Set(current);
        next.delete(STEPS[step].key);
        return next;
      });
    }
    if (delta > 0 && skip) setSkipped((current) => new Set(current).add(STEPS[step].key));
    setError(null);
    setDir(delta);
    if (step + delta >= STEPS.length) return finish();
    setStep((s) => Math.max(0, s + delta));
  }

  function queueBuild(draft: Draft) {
    const key = JSON.stringify({ draft, units });
    if (buildRef.current?.key === key) return buildRef.current.promise;
    const job = buildQueue.current.then(async () => {
      const committed = commitBody(draft);
      const intake: Intake = { ...committed, age: Number(committed.age), heightCm: Number(committed.heightCm), weightKg: Number(committed.weightKg) };
      if (!isEligibleAge(intake.age)) throw new Error(ageBlockMessage());
      const plan = generatePlan(intake, units);
      const split = recommendedSplit(intake, plan.levers.liftingDays);
      await updateProfile((p) => ({ intake, plan, split, settings: { ...p.settings, units }, onboardedAt: p.onboardedAt ?? new Date().toISOString() }));
      return plan;
    });
    buildQueue.current = job.then(
      () => undefined,
      () => undefined
    );
    const entry = { key, promise: job };
    buildRef.current = entry;
    job.then((plan) => {
      if (buildRef.current === entry) buildRef.current = { ...entry, done: plan };
    }).catch(() => {
      if (buildRef.current === entry) buildRef.current = null;
    });
    return job;
  }

  useEffect(() => {
    if (step !== STEPS.length - 1) return;
    queueBuild(d).catch(() => undefined);
  }, [step, d, units]);

  async function finish() {
    const draft = commitBody(d);
    if (draft !== d) setD(draft);
    if (!isEligibleAge(Number(draft.age))) {
      setError(ageBlockMessage());
      return;
    }
    const key = JSON.stringify({ draft, units });
    const ready = buildRef.current?.key === key ? buildRef.current.done : undefined;
    if (ready) {
      setReadyPlan(ready);
      return;
    }
    setBuilding(true);
    try {
      const plan = await (buildRef.current?.key === key ? buildRef.current.promise : queueBuild(draft));
      setReadyPlan(plan);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save your plan.", "error");
    } finally {
      setBuilding(false);
    }
  }

  function continueToPlan() {
    const lines = assumptionLines(skipped, d);
    if (lines.length) sessionStorage.setItem("simplyfit:assumptions", JSON.stringify(lines));
    else sessionStorage.removeItem("simplyfit:assumptions");
    router.replace("/plan?welcome=1");
  }

  const current = STEPS[step];
  const needsBody = step === 1;

  if (building) return <Building />;
  if (readyPlan) return <PlanReveal plan={readyPlan} lines={assumptionLines(skipped, d)} goal={GOAL_LABEL[d.goal]} onContinue={continueToPlan} />;

  return (
    <MotionConfig reducedMotion="never">
    <div className="flex min-h-[100svh] flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-5">
        <Logo href="#" />
        <span className="flex items-center gap-4">
          {isAdminEmail(actor?.email) && (
            <Link href="/admin" className="text-[13px] font-medium text-ink">
              Admin
            </Link>
          )}
          <span className="text-[13px] tabular text-muted">
            {step + 1} of {STEPS.length}
          </span>
        </span>
      </header>
      <div className="mx-auto mt-4 w-full max-w-2xl px-5">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-sunken">
              <motion.div className="h-full bg-accent" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-36 pt-10">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={current.key}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <h1 className="font-display text-[36px] leading-[1.05] tracking-tight sm:text-[44px]">{current.title}</h1>
            <p className="mt-2 text-[15px] text-muted">{current.sub}</p>
            <div className="mt-8 space-y-7">
              {step === 0 && (
                <>
                  <Choices stagger options={GOALS} value={d.goal} onChange={(v) => set("goal", v)} />
                  {d.goal === "custom" && (
                    <Field label="Describe your goal">
                      <Input value={d.customGoal} onChange={(e) => set("customGoal", e.target.value)} placeholder="e.g. Hike Kilimanjaro next summer" autoFocus />
                    </Field>
                  )}
                </>
              )}

              {step === 1 && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Segmented
                      size="sm"
                      value={units.weight}
                      onChange={(v) => setUnits((u) => ({ ...u, weight: v }))}
                      options={[
                        { value: "lb", label: "lb" },
                        { value: "kg", label: "kg" },
                      ]}
                    />
                    <Segmented
                      size="sm"
                      value={units.height}
                      onChange={(v) => setUnits((u) => ({ ...u, height: v }))}
                      options={[
                        { value: "imperial", label: "ft / in" },
                        { value: "metric", label: "cm" },
                      ]}
                    />
                  </div>
                  <Instrument>
                    <InstrumentRow>
                      <ScaleSlider
                        label="Age"
                        value={num(d.age, 28)}
                        display={`${Math.round(num(d.age, 28))} yrs`}
                        min={16}
                        max={90}
                        onChange={(v) => set("age", v)}
                        ticks={[
                          { value: 16, label: "16" },
                          { value: 30, label: "30" },
                          { value: 45, label: "45" },
                          { value: 60, label: "60" },
                          { value: 75, label: "75" },
                          { value: 90, label: "90" },
                        ]}
                      />
                    </InstrumentRow>
                    <InstrumentRow>
                      <HeightScale cm={d.heightCm} metric={units.height === "metric"} onChange={(v) => set("heightCm", v)} />
                    </InstrumentRow>
                    <InstrumentRow>
                      <WeightScale label="Current weight" kg={d.weightKg} unit={units.weight} onChange={(v) => set("weightKg", v)} />
                    </InstrumentRow>
                    <InstrumentRow>
                      <WeightScale
                        label="Goal weight"
                        hint={d.goalWeightKg == null ? "Optional — drag to set a target" : "Optional"}
                        kg={d.goalWeightKg ?? d.weightKg}
                        empty={d.goalWeightKg == null}
                        unit={units.weight}
                        onChange={(v) => set("goalWeightKg", v === "" ? null : v)}
                      />
                      {d.goalWeightKg != null && (
                        <button type="button" onClick={() => set("goalWeightKg", null)} className="mt-1 text-[13px] font-medium text-muted hover:text-ink">
                          Clear goal weight
                        </button>
                      )}
                    </InstrumentRow>
                  </Instrument>
                  <Field label="Sex" hint="Optional — slightly improves the energy estimate.">
                    <Choices
                      stagger
                      columns={3}
                      size="sm"
                      value={d.sex}
                      onChange={(v) => set("sex", v)}
                      options={[
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                        { value: "unspecified", label: "Prefer not to say" },
                      ]}
                    />
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="Lifting experience">
                    <Choices
                      stagger
                      columns={3}
                      size="sm"
                      value={d.experience}
                      onChange={(v) => set("experience", v)}
                      options={[
                        { value: "new", label: "New", description: "Under a year" },
                        { value: "intermediate", label: "Some", description: "1–3 years" },
                        { value: "advanced", label: "Experienced", description: "3+ years" },
                      ]}
                    />
                  </Field>
                  <Instrument>
                    <InstrumentRow>
                      <DayScale value={d.liftingDaysPerWeek} onChange={(v) => set("liftingDaysPerWeek", v)} />
                    </InstrumentRow>
                    <InstrumentRow>
                      <ScaleSlider
                        label="Typical session"
                        value={d.liftingSessionMinutes}
                        display={`${d.liftingSessionMinutes} min`}
                        min={30}
                        max={90}
                        step={5}
                        onChange={(v) => set("liftingSessionMinutes", v)}
                        ticks={[
                          { value: 30, label: "30" },
                          { value: 90, label: "90" },
                        ]}
                      />
                    </InstrumentRow>
                  </Instrument>
                  <Field label="Training style you enjoy">
                    <Choices
                      stagger
                      size="sm"
                      value={d.trainingStyle}
                      onChange={(v) => set("trainingStyle", v)}
                      options={[
                        { value: "general", label: "Balanced", description: "Strength and fitness" },
                        { value: "hypertrophy", label: "Build muscle", description: "Moderate reps, more volume" },
                        { value: "strength", label: "Get stronger", description: "Heavier, lower reps" },
                        { value: "athletic", label: "Athletic", description: "Power and conditioning" },
                      ]}
                    />
                  </Field>
                  <Field label="Equipment you have">
                    <Choices
                      stagger
                      size="sm"
                      value={d.equipment}
                      onChange={(v) => set("equipment", v)}
                      options={(Object.keys(EQUIPMENT_LABEL) as Intake["equipment"][]).map((k) => ({ value: k, label: EQUIPMENT_LABEL[k] }))}
                    />
                  </Field>
                </>
              )}

              {step === 3 && (
                <>
                  <Instrument>
                    <InstrumentRow>
                      <ScaleSlider
                        label="Cardio per week"
                        value={d.cardioMinutesPerWeek}
                        display={d.cardioMinutesPerWeek === 0 ? "None" : `${d.cardioMinutesPerWeek} min`}
                        hint={d.cardioMinutesPerWeek === 0 ? undefined : `About ${Math.round(d.cardioMinutesPerWeek / 7)} min a day`}
                        min={0}
                        max={420}
                        step={10}
                        onChange={(v) => set("cardioMinutesPerWeek", v)}
                        ticks={[
                          { value: 0, label: "0" },
                          { value: 120, label: "2h" },
                          { value: 240, label: "4h" },
                          { value: 420, label: "7h" },
                        ]}
                      />
                    </InstrumentRow>
                    <InstrumentRow>
                      <ScaleSlider
                        label="Average daily steps"
                        value={d.averageSteps}
                        display={d.averageSteps.toLocaleString()}
                        min={1000}
                        max={20000}
                        step={500}
                        onChange={(v) => set("averageSteps", v)}
                        ticks={[
                          { value: 1000, label: "1k" },
                          { value: 5000, label: "5k" },
                          { value: 10000, label: "10k" },
                          { value: 15000, label: "15k" },
                          { value: 20000, label: "20k" },
                        ]}
                      />
                    </InstrumentRow>
                    <InstrumentRow>
                      <ScaleSlider
                        label="Average sleep"
                        value={d.sleepHours}
                        display={sleepLabel(d.sleepHours)}
                        min={4}
                        max={10}
                        step={0.25}
                        onChange={(v) => set("sleepHours", v)}
                        ticks={[
                          { value: 4, label: "4h" },
                          { value: 6, label: "6h" },
                          { value: 8, label: "8h" },
                          { value: 10, label: "10h" },
                        ]}
                      />
                    </InstrumentRow>
                  </Instrument>
                  <Field label="Outside of workouts, your day is mostly…">
                    <Choices
                      stagger
                      size="sm"
                      value={d.activityLevel}
                      onChange={(v) => set("activityLevel", v)}
                      options={[
                        { value: "sedentary", label: "Sitting", description: "Desk job, little moving" },
                        { value: "light", label: "Lightly active", description: "Some standing and walking" },
                        { value: "moderate", label: "On my feet", description: "Retail, teaching, nursing" },
                        { value: "active", label: "Physical work", description: "Trades, warehouse, labor" },
                      ]}
                    />
                  </Field>
                </>
              )}

              {step === 4 && (
                <>
                  <Field label="Food preferences" hint="Select any that apply.">
                    <DietPicks options={DIETS} value={d.dietaryPreferences} onToggle={(x) => set("dietaryPreferences", toggle(d.dietaryPreferences, x))} />
                  </Field>
                  <Field label="Allergies or foods you avoid" hint="Optional">
                    <Textarea value={d.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="e.g. peanuts, shellfish" rows={2} />
                  </Field>
                  <Field label="Meal rhythm">
                    <MealRhythm value={d.mealStructure} onChange={(v) => set("mealStructure", v)} />
                  </Field>
                </>
              )}

              {step === 5 && <PaceStep d={d} units={units} set={set} toggle={toggle} />}
            </div>
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-5 py-3.5">
          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} role="alert" className="mb-3 text-[13px] text-clay">
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0} aria-label="Back">
              <ArrowLeft className="size-4" /> Back
            </Button>
            <div className="flex gap-2">
              {!needsBody && step > 1 && (
                <Button variant="ghost" onClick={() => go(1, true)}>
                  Skip
                </Button>
              )}
              <Button onClick={() => go(1)} size="lg">
                {step === STEPS.length - 1 ? (
                  <>
                    <Sparkles className="size-4" /> Build my plan
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}

function PaceStep({
  d,
  units,
  set,
  toggle,
}: {
  d: Draft;
  units: Settings["units"];
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  toggle: <T extends string>(list: T[], v: T) => T[];
}) {
  const directional = d.goal === "fat_loss" || d.goal === "muscle_gain";
  const w = Number(d.weightKg) || 75;
  const { maxLoss, maxGain } = rateBounds({ ...(d as unknown as Intake), weightKg: w });
  const lb = units.weight === "lb";
  const options =
    d.goal === "fat_loss"
      ? [
          { value: w * 0.0035, label: "Gentle", description: "Easiest to sustain, most food" },
          { value: w * 0.006, label: "Steady", description: "Recommended for most people" },
          { value: Math.abs(maxLoss), label: "Faster", description: "Harder; best for shorter phases" },
        ]
      : [
          { value: w * 0.0015, label: "Lean", description: "Minimal fat gain, slower" },
          { value: w * 0.0025, label: "Steady", description: "Recommended for most people" },
          { value: maxGain, label: "Faster", description: "More food, some extra fat gain" },
        ];
  const fmt = (kg: number) => `${(lb ? kgToLb(kg) : kg).toFixed(lb ? 1 : 2)} ${units.weight}/week`;
  const selected = d.weeklyRateKg
    ? options.reduce((best, o) => (Math.abs(o.value - d.weeklyRateKg) < Math.abs(best.value - d.weeklyRateKg) ? o : best), options[1])
    : options[1];

  const PRIORITIES: { value: Priority; label: string; description: string; icon: React.ReactNode }[] = [
    { value: "more_food", label: "More food", description: "I'd rather walk more than eat less", icon: <Utensils className="size-4" /> },
    { value: "less_cardio", label: "Less cardio", description: "Keep cardio light", icon: <Timer className="size-4" /> },
    { value: "fewer_days", label: "Fewer training days", description: "My schedule is tight", icon: <CalendarDays className="size-4" /> },
    { value: "faster", label: "Faster results", description: "I'm okay with a tougher plan", icon: <Zap className="size-4" /> },
  ];

  return (
    <>
      {directional && (
        <Field label={d.goal === "fat_loss" ? "How quickly would you like to lose weight?" : "How quickly would you like to gain?"}>
          <PaceCards
            value={selected.label}
            onChange={(label) => set("weeklyRateKg", options.find((o) => o.label === label)!.value)}
            options={options.map((o) => ({ id: o.label, label: o.label, figure: fmt(o.value), description: o.description }))}
          />
        </Field>
      )}
      <Field label="What matters most to you?" hint="Optional — choose any.">
        <Choices stagger multiple value={d.priorities} onChange={(v) => set("priorities", toggle(d.priorities, v))} options={PRIORITIES} />
      </Field>
      <p className="rounded-2xl bg-sunken/70 px-4 py-3 text-[13px] leading-relaxed text-muted">
        Simply Fit gives general fitness and nutrition guidance, not medical advice. If you're pregnant, managing a medical condition, or have a history of disordered
        eating, please check with a qualified professional before changing how you eat.
      </p>
    </>
  );
}

function num(value: number | "" | null, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function commitBody(draft: Draft): Draft {
  if (draft.age !== "" && draft.heightCm !== "" && draft.weightKg !== "") return draft;
  return {
    ...draft,
    age: num(draft.age, 28),
    heightCm: num(draft.heightCm, 175),
    weightKg: num(draft.weightKg, 77),
  };
}

function sleepLabel(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function feetLabel(totalInches: number) {
  const ft = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${ft}′${inches}″`;
}

function HeightScale({ cm, metric, onChange }: { cm: number | ""; metric: boolean; onChange: (cm: number) => void }) {
  if (metric) {
    const value = Math.round(num(cm, 175));
    return (
      <ScaleSlider
        label="Height"
        value={value}
        display={`${value} cm`}
        min={120}
        max={230}
        onChange={onChange}
        ticks={[
          { value: 120, label: "120" },
          { value: 160, label: "160" },
          { value: 190, label: "190" },
          { value: 230, label: "230" },
        ]}
      />
    );
  }
  const inches = Math.round(num(cm, 175) / 2.54);
  return (
    <ScaleSlider
      label="Height"
      value={inches}
      display={feetLabel(inches)}
      min={48}
      max={90}
      onChange={(v) => onChange(Math.round(v * 2.54))}
      ticks={[
        { value: 48, label: "4′" },
        { value: 60, label: "5′" },
        { value: 72, label: "6′" },
        { value: 84, label: "7′" },
        { value: 90, label: "7′6″" },
      ]}
    />
  );
}

function WeightScale({
  label,
  hint,
  kg,
  unit,
  empty,
  onChange,
}: {
  label: string;
  hint?: string;
  kg: number | "" | null;
  unit: "lb" | "kg";
  empty?: boolean;
  onChange: (kg: number | "") => void;
}) {
  const lb = unit === "lb";
  const fallback = lb ? 170 : 77;
  const shown = Math.round(num(kg === "" || kg == null ? "" : lb ? kgToLb(kg) : kg, fallback));
  return (
    <ScaleSlider
      label={label}
      hint={hint}
      muted={empty}
      value={shown}
      display={empty ? "None" : `${shown} ${unit}`}
      min={lb ? 90 : 40}
      max={lb ? 400 : 180}
      onChange={(v) => onChange(lb ? lbToKg(v) : v)}
      ticks={(lb ? [90, 160, 230, 300, 400] : [40, 80, 120, 160, 180]).map((n) => ({ value: n, label: String(n) }))}
    />
  );
}

const EXPERIENCE_LABEL = { new: "new to lifting", intermediate: "some lifting experience", advanced: "experienced" } as const;
const ACTIVITY_LABEL = { sedentary: "mostly sitting", light: "lightly active", moderate: "on your feet", active: "physical work", very_active: "very active" } as const;
const MEAL_LABEL = { three_meals: "three meals", three_plus_snacks: "meals plus snacks", two_meals: "two bigger meals", flexible: "a flexible meal rhythm" } as const;

function assumptionLines(skipped: Set<string>, d: Draft) {
  const lines: string[] = [];
  if (skipped.has("training")) {
    lines.push(`Training: ${EXPERIENCE_LABEL[d.experience]}, ${d.liftingDaysPerWeek} lifting days a week, ${d.liftingSessionMinutes}-minute sessions, ${EQUIPMENT_LABEL[d.equipment].toLowerCase()}.`);
  }
  if (skipped.has("activity")) {
    lines.push(`Activity: about ${d.averageSteps.toLocaleString()} steps a day, ${d.cardioMinutesPerWeek} minutes of cardio a week, ${d.sleepHours} hours of sleep, and days that are ${ACTIVITY_LABEL[d.activityLevel]}.`);
  }
  if (skipped.has("food")) {
    const diets = d.dietaryPreferences.length ? d.dietaryPreferences.join(", ") : "no diet selected";
    const avoid = d.allergies.trim() ? `avoiding ${d.allergies.trim()}` : "nothing listed to avoid";
    lines.push(`Food: ${diets}, ${MEAL_LABEL[d.mealStructure]}, ${avoid}.`);
  }
  if (skipped.has("pace")) {
    lines.push(d.priorities.length ? "Pace: the steady default, plus priorities you had already picked." : "Pace: a steady rate, with no extra priorities.");
  }
  return lines;
}

function PlanReveal({ plan, lines, goal, onContinue }: { plan: Plan; lines: string[]; goal: string; onContinue: () => void }) {
  const stats = [
    ["Calories", plan.calorieTarget.toLocaleString()],
    ["Protein", `${plan.proteinG} g`],
    ["Lifting", `${plan.levers.liftingDays} days / week`],
    ["Steps", plan.levers.stepTarget.toLocaleString()],
    ["Cardio", `${plan.levers.cardioMinutesPerWeek} min / week`],
    ["Sleep", `${plan.sleepTargetHours} h`],
  ];
  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col px-5 py-8">
      <Logo href="#" />
      <p className="mt-10 text-[13px] font-medium uppercase tracking-[0.14em] text-accent">{goal}</p>
      <h1 className="mt-2 font-display text-[40px] leading-[1.05] tracking-tight sm:text-[48px]">Here's your plan</h1>
      <p className="mt-2 text-[15px] text-muted">These are the numbers we'll use. You can change any of them on the next screen.</p>
      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface px-4 py-3">
            <dt className="text-[12px] text-muted">{label}</dt>
            <dd className="mt-1 text-[18px] font-semibold tabular tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 rounded-2xl bg-sunken/70 px-4 py-3 text-[13px] leading-relaxed text-muted">
        {lines.length ? (
          <>
            <p className="font-medium text-ink-soft">You skipped a few steps, so these are assumptions:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>You answered each step, so nothing here was filled in behind your back.</p>
        )}
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-muted">General fitness guidance, not medical advice. Change anything that doesn't fit.</p>
      <div className="mt-8">
        <Button size="lg" onClick={onContinue}>
          See the full plan <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Building() {
  const lines = ["Estimating your energy needs", "Balancing food, steps, and cardio", "Setting up your training week", "Writing your plan"];
  return (
    <div className="grid min-h-[100svh] place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="sf-spin mb-8 size-12 rounded-full border-2 border-accent-soft border-t-accent" />
        <h1 className="font-display text-[36px] leading-tight">Building your plan</h1>
        <ul className="mt-6 space-y-3">
          {lines.map((l, i) => (
            <motion.li key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.3 }} className="flex items-center gap-3 text-[15px] text-ink-soft">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.3 + 0.2 }} className="grid size-5 place-items-center rounded-full bg-accent-soft">
                <Dumbbell className="size-2.5 text-accent" />
              </motion.span>
              {l}
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
