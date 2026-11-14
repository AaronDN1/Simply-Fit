"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Dumbbell, HeartPulse, Leaf, Mountain, Scale, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Choices, Field, Input, Segmented, Slider, Textarea, UnitInput } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import type { Goal, Intake, Plan, Priority, Settings } from "@/lib/types";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from "@/lib/units";
import { ageBlockMessage, isEligibleAge } from "@/lib/legal";
import { GOAL_LABEL, generatePlan, rateBounds } from "@/lib/plan";
import { recommendedSplit, EQUIPMENT_LABEL } from "@/lib/workouts";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

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
  const { data, updateProfile } = useStore();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [d, setD] = useState<Draft>(() => (data.profile.intake ? { ...DEFAULT, ...data.profile.intake } : DEFAULT));
  const [units, setUnits] = useState<Settings["units"]>(data.profile.settings.units);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [readyPlan, setReadyPlan] = useState<Plan | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function validate() {
    if (step === 1) {
      if (d.age !== "" && d.age < 16) return "Simply Fit is for people 16 and older, so we can't build a plan or store health data for this age.";
      if (!d.age || d.age > 90) return "Enter an age between 16 and 90.";
      if (!d.heightCm || d.heightCm < 120 || d.heightCm > 230) return "Enter your height.";
      if (!d.weightKg || d.weightKg < 35 || d.weightKg > 300) return "Enter your current weight.";
    }
    if (step === 0 && d.goal === "custom" && !d.customGoal.trim()) return "Tell us a little about your goal, or pick one above.";
    return null;
  }

  function go(delta: number, skip = false) {
    if (delta > 0 && !skip) {
      const e = validate();
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

  async function finish() {
    const intake: Intake = { ...d, age: Number(d.age), heightCm: Number(d.heightCm), weightKg: Number(d.weightKg) };
    if (!isEligibleAge(intake.age)) {
      setError(ageBlockMessage());
      return;
    }
    setBuilding(true);
    try {
      const plan = generatePlan(intake, units);
      const split = recommendedSplit(intake, plan.levers.liftingDays);
      await Promise.all([updateProfile((p) => ({ intake, plan, split, settings: { ...p.settings, units }, onboardedAt: new Date().toISOString() })), new Promise((r) => setTimeout(r, 1400))]);
      setReadyPlan(plan);
      setBuilding(false);
    } catch (e) {
      setBuilding(false);
      toast(e instanceof Error ? e.message : "Couldn't save your plan.", "error");
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
    <div className="flex min-h-[100svh] flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-5">
        <Logo href="#" />
        <span className="text-[13px] tabular text-muted">
          {step + 1} of {STEPS.length}
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
                  <Choices options={GOALS} value={d.goal} onChange={(v) => set("goal", v)} />
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Age">
                      <UnitInput value={d.age} onChange={(v) => set("age", v)} unit="yrs" placeholder="22" />
                    </Field>
                    <HeightInput cm={d.heightCm} metric={units.height === "metric"} onChange={(v) => set("heightCm", v)} />
                    <Field label="Current weight">
                      <WeightInput kg={d.weightKg} unit={units.weight} onChange={(v) => set("weightKg", v)} />
                    </Field>
                    <Field label="Goal weight" hint="Optional">
                      <WeightInput kg={d.goalWeightKg ?? ""} unit={units.weight} onChange={(v) => set("goalWeightKg", v === "" ? null : v)} />
                    </Field>
                  </div>
                  <Field label="Sex" hint="Optional — slightly improves the energy estimate.">
                    <Choices
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
                  <Stepper label="Lifting days per week" value={d.liftingDaysPerWeek} min={0} max={7} onChange={(v) => set("liftingDaysPerWeek", v)} suffix={d.liftingDaysPerWeek === 7 ? "every day" : "days"} />
                  <Field label="Typical session length">
                    <Segmented
                      value={String(d.liftingSessionMinutes) as "30"}
                      onChange={(v) => set("liftingSessionMinutes", Number(v))}
                      options={["30", "45", "60", "75", "90"].map((v) => ({ value: v as "30", label: `${v}m` }))}
                    />
                  </Field>
                  <Field label="Training style you enjoy">
                    <Choices
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
                  <RangeField
                    label="Cardio per week"
                    value={d.cardioMinutesPerWeek}
                    display={d.cardioMinutesPerWeek === 0 ? "None" : `${d.cardioMinutesPerWeek} min · ~${Math.round(d.cardioMinutesPerWeek / 7)}/day`}
                    min={0}
                    max={420}
                    step={10}
                    onChange={(v) => set("cardioMinutesPerWeek", v)}
                  />
                  <RangeField
                    label="Average daily steps"
                    value={d.averageSteps}
                    display={d.averageSteps.toLocaleString()}
                    min={1000}
                    max={20000}
                    step={500}
                    onChange={(v) => set("averageSteps", v)}
                  />
                  <RangeField
                    label="Average sleep"
                    value={d.sleepHours}
                    display={`${Math.floor(d.sleepHours)}h ${Math.round((d.sleepHours % 1) * 60)}m`}
                    min={4}
                    max={10}
                    step={0.25}
                    onChange={(v) => set("sleepHours", v)}
                  />
                  <Field label="Outside of workouts, your day is mostly…">
                    <Choices
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
                    <div className="flex flex-wrap gap-2">
                      {DIETS.map((x) => {
                        const on = d.dietaryPreferences.includes(x);
                        return (
                          <button
                            key={x}
                            type="button"
                            onClick={() => set("dietaryPreferences", toggle(d.dietaryPreferences, x))}
                            className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", on ? "border-accent bg-accent-tint text-accent-strong" : "border-line bg-surface text-ink-soft hover:border-line-strong")}
                          >
                            {x}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Allergies or foods you avoid" hint="Optional">
                    <Textarea value={d.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="e.g. peanuts, shellfish" rows={2} />
                  </Field>
                  <Field label="Meal rhythm">
                    <Choices
                      size="sm"
                      value={d.mealStructure}
                      onChange={(v) => set("mealStructure", v)}
                      options={[
                        { value: "three_meals", label: "Three meals" },
                        { value: "three_plus_snacks", label: "Meals + snacks" },
                        { value: "two_meals", label: "Two bigger meals" },
                        { value: "flexible", label: "It varies" },
                      ]}
                    />
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

  const PRIORITIES: { value: Priority; label: string; description: string }[] = [
    { value: "more_food", label: "More food", description: "I'd rather walk more than eat less" },
    { value: "less_cardio", label: "Less cardio", description: "Keep cardio light" },
    { value: "fewer_days", label: "Fewer training days", description: "My schedule is tight" },
    { value: "faster", label: "Faster results", description: "I'm okay with a tougher plan" },
  ];

  return (
    <>
      {directional && (
        <Field label={d.goal === "fat_loss" ? "How quickly would you like to lose weight?" : "How quickly would you like to gain?"}>
          <Choices
            columns={3}
            size="sm"
            value={selected.label}
            onChange={(label) => set("weeklyRateKg", options.find((o) => o.label === label)!.value)}
            options={options.map((o) => ({ value: o.label, label: o.label, description: `${fmt(o.value)} · ${o.description}` }))}
          />
        </Field>
      )}
      <Field label="What matters most to you?" hint="Optional — choose any.">
        <Choices multiple value={d.priorities} onChange={(v) => set("priorities", toggle(d.priorities, v))} options={PRIORITIES} />
      </Field>
      <p className="rounded-2xl bg-sunken/70 px-4 py-3 text-[13px] leading-relaxed text-muted">
        Simply Fit gives general fitness and nutrition guidance, not medical advice. If you're pregnant, managing a medical condition, or have a history of disordered
        eating, please check with a qualified professional before changing how you eat.
      </p>
    </>
  );
}

function Stepper({ label, value, min, max, onChange, suffix }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={n === value}
              className={cn(
                "grid size-9 place-items-center rounded-xl border sm:size-10 text-[15px] font-medium tabular transition-colors",
                n === value ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-soft hover:border-line-strong"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="hidden text-sm text-muted sm:inline">{suffix}</span>
      </div>
    </div>
  );
}

function RangeField({ label, value, display, min, max, step, onChange }: { label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
        <span className="text-[15px] font-medium tabular">{display}</span>
      </div>
      <Slider ariaLabel={label} value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  );
}

function WeightInput({ kg, unit, onChange }: { kg: number | ""; unit: "lb" | "kg"; onChange: (kg: number | "") => void }) {
  const shown = kg === "" ? "" : Math.round((unit === "lb" ? kgToLb(kg) : kg) * 10) / 10;
  return <UnitInput value={shown} unit={unit} placeholder={unit === "lb" ? "170" : "77"} onChange={(v) => onChange(v === "" ? "" : unit === "lb" ? lbToKg(v) : v)} />;
}

function HeightInput({ cm, metric, onChange }: { cm: number | ""; metric: boolean; onChange: (cm: number | "") => void }) {
  if (metric)
    return (
      <Field label="Height">
        <UnitInput value={cm === "" ? "" : Math.round(cm)} unit="cm" placeholder="183" onChange={onChange} />
      </Field>
    );
  const { ft, inches } = cm === "" ? { ft: "" as const, inches: "" as const } : cmToFtIn(cm);
  return (
    <Field label="Height">
      <div className="grid grid-cols-2 gap-2">
        <UnitInput ariaLabel="Feet" value={ft} unit="ft" placeholder="6" onChange={(v) => onChange(v === "" ? "" : ftInToCm(v, inches === "" ? 0 : inches))} />
        <UnitInput ariaLabel="Inches" value={inches} unit="in" placeholder="0" onChange={(v) => onChange(ftInToCm(ft === "" ? 5 : ft, v === "" ? 0 : v))} />
      </div>
    </Field>
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
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} className="mb-8 size-12 rounded-full border-2 border-accent-soft border-t-accent" />
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
