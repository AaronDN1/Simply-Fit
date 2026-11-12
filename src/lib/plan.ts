import type { EnergyBreakdown, Goal, Intake, Plan, PlanLevers, Settings } from "./types";
import { clamp, round } from "./utils";
import { displayWeight } from "./units";

/** ~7,700 kcal per kg of body-weight change is the standard planning approximation. */
export const KCAL_PER_KG = 7700;
const BASELINE_STEPS = 2500;

const LIFESTYLE_FACTOR: Record<Intake["activityLevel"], number> = {
  sedentary: 0,
  light: 0.05,
  moderate: 0.1,
  active: 0.18,
  very_active: 0.27,
};

export const GOAL_LABEL: Record<Goal, string> = {
  fat_loss: "Lose fat",
  muscle_gain: "Build muscle",
  maintenance: "Maintain",
  recomp: "Recomposition",
  endurance: "Endurance",
  general_health: "General health",
  custom: "Custom goal",
};

export function goalDirection(goal: Goal): -1 | 0 | 1 {
  if (goal === "fat_loss") return -1;
  if (goal === "muscle_gain") return 1;
  return 0;
}

export function bmr(intake: Pick<Intake, "weightKg" | "heightCm" | "age" | "sex">) {
  const base = 10 * intake.weightKg + 6.25 * intake.heightCm - 5 * intake.age;
  const sexAdj = intake.sex === "male" ? 5 : intake.sex === "female" ? -161 : -78;
  return base + sexAdj;
}

export function kcalPerThousandSteps(weightKg: number) {
  return 0.5 * weightKg;
}

export function kcalPerCardioMinute(weightKg: number) {
  // Moderate steady-state cardio, net of resting expenditure (~5 METs net).
  return (5 * weightKg) / 60;
}

function liftingKcalPerSession(weightKg: number, minutes: number) {
  // Resistance training with rest periods, net ~3 METs.
  return (3 * weightKg * minutes) / 60;
}

export function energyBreakdown(intake: Intake, levers: Pick<PlanLevers, "stepTarget" | "cardioMinutesPerWeek" | "liftingDays">): EnergyBreakdown {
  const b = bmr(intake);
  const baseline = b * 1.15; // BMR + thermic effect of food + minimal daily movement
  const steps = (Math.max(0, levers.stepTarget - BASELINE_STEPS) / 1000) * kcalPerThousandSteps(intake.weightKg);
  const lifting = (levers.liftingDays * liftingKcalPerSession(intake.weightKg, intake.liftingSessionMinutes || 60)) / 7;
  const cardio = (levers.cardioMinutesPerWeek * kcalPerCardioMinute(intake.weightKg)) / 7;
  const lifestyle = b * LIFESTYLE_FACTOR[intake.activityLevel];
  return { bmr: b, baseline, steps, lifting, cardio, lifestyle };
}

export function maintenanceFrom(b: EnergyBreakdown) {
  return b.baseline + b.steps + b.lifting + b.cardio + b.lifestyle;
}

export function calorieFloor(intake: Intake) {
  const sexFloor = intake.sex === "female" ? 1200 : intake.sex === "male" ? 1500 : 1350;
  return Math.max(sexFloor, Math.round(bmr(intake)));
}

/** Safe bounds for weekly change, in kg (signed). */
export function rateBounds(intake: Intake) {
  return {
    maxLoss: -round(intake.weightKg * 0.01, 0.01),
    maxGain: round(intake.weightKg * 0.005, 0.01),
  };
}

function referenceWeightKg(intake: Intake) {
  const h = intake.heightCm / 100;
  const bmi = intake.weightKg / (h * h);
  // For higher body-fat levels, base protein on a reference weight to avoid unrealistic targets.
  return bmi > 30 ? 27 * h * h : intake.weightKg;
}

export function defaultLevers(intake: Intake): PlanLevers {
  const dir = goalDirection(intake.goal);
  const p = new Set(intake.priorities);

  let rate = 0;
  if (dir !== 0) {
    const requested = intake.weeklyRateKg || (dir < 0 ? intake.weightKg * 0.006 : intake.weightKg * 0.0025);
    rate = dir * requested;
    if (p.has("more_food")) rate *= 0.75;
    if (p.has("faster")) rate *= 1.2;
  } else if (intake.goal === "recomp") {
    rate = -Math.min(0.25, intake.weightKg * 0.0025);
  }
  const { maxLoss, maxGain } = rateBounds(intake);
  rate = clamp(rate, maxLoss, maxGain);

  let stepTarget = round(Math.max(intake.averageSteps, 6000), 500);
  if (dir < 0 && intake.averageSteps < 8000) stepTarget = round(Math.min(intake.averageSteps + 2000, 8000), 500);
  if (p.has("more_food")) stepTarget = Math.min(stepTarget + 1500, 14000);

  let cardio = intake.cardioMinutesPerWeek;
  if (intake.goal === "endurance") cardio = Math.max(cardio, 150);
  else if (intake.goal === "general_health") cardio = Math.max(cardio, 120);
  else if (dir < 0) cardio = Math.max(cardio, 60);
  else if (dir > 0) cardio = Math.min(Math.max(cardio, 60), 150);
  if (p.has("less_cardio")) cardio = Math.min(cardio, 60);
  cardio = round(cardio, 10);

  let days = intake.liftingDaysPerWeek;
  if (days === 0) days = intake.goal === "endurance" ? 2 : 3;
  if (intake.experience === "new") days = Math.min(days, 4);
  days = Math.min(days, 6); // keep at least one full rest day
  if (intake.goal === "endurance") days = Math.min(days, 3);
  if (p.has("fewer_days")) days = Math.max(2, days - 1);

  return { weeklyRateKg: round(rate, 0.01), stepTarget, cardioMinutesPerWeek: cardio, liftingDays: days };
}

interface BuildOptions {
  units?: Settings["units"];
}

export function buildPlan(intake: Intake, leversIn: PlanLevers, opts: BuildOptions = {}): Plan {
  const units = opts.units ?? { weight: "lb", height: "imperial" };
  const warnings: string[] = [];
  const { maxLoss, maxGain } = rateBounds(intake);
  const levers: PlanLevers = {
    weeklyRateKg: clamp(leversIn.weeklyRateKg, maxLoss, maxGain),
    stepTarget: clamp(round(leversIn.stepTarget, 500), 3000, 25000),
    cardioMinutesPerWeek: clamp(round(leversIn.cardioMinutesPerWeek, 10), 0, 600),
    liftingDays: clamp(Math.round(leversIn.liftingDays), 0, 7),
  };

  const breakdown = energyBreakdown(intake, levers);
  const maintenance = maintenanceFrom(breakdown);
  let target = maintenance + (levers.weeklyRateKg * KCAL_PER_KG) / 7;
  const floor = calorieFloor(intake);
  if (target < floor) {
    target = floor;
    levers.weeklyRateKg = round(((target - maintenance) * 7) / KCAL_PER_KG, 0.01);
    warnings.push(
      `Calories are held at ${floor} — the lowest we'll recommend for you — so your pace is adjusted to match.`
    );
  }
  target = round(target, 10);

  const refKg = referenceWeightKg(intake);
  const proteinPerKg =
    intake.goal === "fat_loss" || intake.goal === "recomp" ? 2.0 : intake.goal === "muscle_gain" ? 1.8 : intake.goal === "endurance" ? 1.6 : 1.6;
  let proteinG = round(refKg * proteinPerKg, 5);
  const fatShare = intake.goal === "endurance" ? 0.25 : 0.27;
  let fatG = round(Math.max((target * fatShare) / 9, intake.weightKg * 0.6), 1);
  let carbsG = round((target - proteinG * 4 - fatG * 9) / 4, 5);
  if (carbsG < 50) {
    carbsG = 50;
    fatG = round(Math.max((target - proteinG * 4 - carbsG * 4) / 9, intake.weightKg * 0.5), 1);
    proteinG = round((target - fatG * 9 - carbsG * 4) / 4, 5);
  }

  const sleepTargetHours = intake.sleepHours >= 7 ? clamp(round(intake.sleepHours, 0.5), 7, 9) : 7.5;

  const recovery: string[] = [];
  if (levers.liftingDays >= 6) recovery.push("Keep at least one full rest day each week; it's when strength gains consolidate.");
  else recovery.push(`${7 - levers.liftingDays} rest or easy-movement days are built into your week.`);
  recovery.push(`Aim for ${sleepTargetHours} hours of sleep — it's the cheapest recovery tool you have.`);
  if (levers.weeklyRateKg < -0.005 * intake.weightKg)
    recovery.push("In a steeper deficit, keep most sets 1–3 reps shy of failure and take a lighter week if energy dips for several days.");
  else recovery.push("Train most sets 1–3 reps from failure; save all-out efforts for the last set of a lift.");
  if (levers.cardioMinutesPerWeek >= 150) recovery.push("Keep most cardio easy (you can hold a conversation) so it doesn't eat into lifting recovery.");
  recovery.push("Use the daily check-in: low energy or high soreness is a cue to go lighter, not to skip entirely.");

  const fmtW = (kg: number) => `${Math.abs(displayWeight(kg, units, 2))} ${units.weight}`;
  const explanation: string[] = [];
  explanation.push(
    `Your body uses roughly ${round(maintenance, 10).toLocaleString()} calories a day at this activity level — about ${round(breakdown.baseline, 10).toLocaleString()} just to run, plus ${round(breakdown.steps + breakdown.lifting + breakdown.cardio + breakdown.lifestyle, 10).toLocaleString()} from steps, training, and daily life.`
  );
  if (levers.weeklyRateKg < -0.01)
    explanation.push(
      `Eating ${target.toLocaleString()} creates a ~${round(maintenance - target, 10)} calorie daily gap, which works out to about ${fmtW(levers.weeklyRateKg)} per week. That pace is sustainable and protects muscle.`
    );
  else if (levers.weeklyRateKg > 0.01)
    explanation.push(
      `Eating ${target.toLocaleString()} gives a modest ~${round(target - maintenance, 10)} calorie surplus — about ${fmtW(levers.weeklyRateKg)} per week, which favors muscle over fat gain.`
    );
  else explanation.push(`Eating close to maintenance keeps your weight stable while training drives the changes.`);
  explanation.push(
    `Protein is set at ${proteinG} g to support ${intake.goal === "fat_loss" ? "muscle retention while losing fat" : "recovery and muscle growth"}. Fat stays around ${fatG} g for hormones and satiety, and carbs (${carbsG} g) fuel your training.`
  );
  explanation.push(
    `${levers.liftingDays} lifting days, ${levers.cardioMinutesPerWeek} minutes of cardio, and ${levers.stepTarget.toLocaleString()} daily steps match what you already do${intake.experience === "new" ? " while giving you room to build the habit" : ""}.`
  );
  if (intake.goalWeightKg && levers.weeklyRateKg !== 0) {
    const diff = intake.goalWeightKg - intake.weightKg;
    if (Math.sign(diff) === Math.sign(levers.weeklyRateKg)) {
      const weeks = Math.ceil(Math.abs(diff / levers.weeklyRateKg));
      explanation.push(`At this pace you'd reach your goal weight in roughly ${weeks} weeks. Real progress won't be a straight line, and that's normal.`);
    }
  }

  return {
    levers,
    maintenanceCalories: round(maintenance, 10),
    calorieTarget: target,
    proteinG,
    carbsG,
    fatG,
    sleepTargetHours,
    breakdown,
    recovery,
    explanation,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

export function generatePlan(intake: Intake, units?: Settings["units"]) {
  return buildPlan(intake, defaultLevers(intake), { units });
}

/** Solve for the weekly rate that produces a given calorie target at the current activity levers. */
export function rateForCalories(intake: Intake, levers: PlanLevers, calories: number) {
  const maintenance = maintenanceFrom(energyBreakdown(intake, levers));
  return ((calories - maintenance) * 7) / KCAL_PER_KG;
}

/**
 * Plain-language explanation of what changed between two plans and what it costs.
 * Returns short sentences the UI can show directly under the sliders.
 */
export function explainTradeoff(intake: Intake, before: Plan, after: Plan, units: Settings["units"]): string[] {
  const out: string[] = [];
  const w = intake.weightKg;
  const dCal = after.calorieTarget - before.calorieTarget;
  const dRate = after.levers.weeklyRateKg - before.levers.weeklyRateKg;
  const dSteps = after.levers.stepTarget - before.levers.stepTarget;
  const dCardio = after.levers.cardioMinutesPerWeek - before.levers.cardioMinutesPerWeek;
  const dDays = after.levers.liftingDays - before.levers.liftingDays;
  const unit = units.weight;
  const fmtRate = (kg: number) => `${Math.abs(displayWeight(kg, units, 2))} ${unit}/week`;

  const activityChanged = dSteps !== 0 || dCardio !== 0 || dDays !== 0;

  if (activityChanged) {
    const parts: string[] = [];
    if (dSteps) parts.push(`${dSteps > 0 ? "+" : ""}${dSteps.toLocaleString()} steps/day`);
    if (dCardio) parts.push(`${dCardio > 0 ? "+" : ""}${dCardio} cardio min/week`);
    if (dDays) parts.push(`${dDays > 0 ? "+" : ""}${dDays} lifting day${Math.abs(dDays) === 1 ? "" : "s"}`);
    const verb = dCal >= 0 ? "adds" : "removes";
    out.push(`${parts.join(", ")} ${verb} about ${Math.abs(Math.round(dCal / 10) * 10)} calories of daily food at the same pace.`);
  } else if (dCal !== 0) {
    if (Math.abs(dRate) > 0.004) {
      const losing = after.levers.weeklyRateKg < 0;
      const slower = losing ? dCal > 0 : dCal < 0;
      out.push(
        `${dCal > 0 ? "Eating" : "Cutting"} ${Math.abs(dCal)} ${dCal > 0 ? "more" : "fewer"} calories a day moves your pace to ${after.levers.weeklyRateKg === 0 ? "maintenance" : fmtRate(after.levers.weeklyRateKg)} — ${slower ? "slower, but easier to stick with" : "faster, but harder to sustain"}.`
      );
    }
    if (dCal > 0 && after.levers.weeklyRateKg < 0) {
      const steps = Math.round((dCal / kcalPerThousandSteps(w)) * 1000 / 500) * 500;
      const mins = Math.round(((dCal * 7) / kcalPerCardioMinute(w)) / 10) * 10;
      out.push(`To keep your original pace instead, you could add about ${steps.toLocaleString()} steps a day or ${mins} minutes of cardio a week.`);
    }
  }
  if (dDays < 0 && after.levers.liftingDays < 3 && intake.goal === "muscle_gain")
    out.push("Fewer than 3 lifting days makes muscle gain slower — make each session count.");
  if (dDays > 0 && after.levers.liftingDays >= 6) out.push("Six-plus training days need good sleep and food to recover from.");
  if (after.warnings.length) out.push(...after.warnings);
  return out;
}

/** Simple readiness score 0–100 from a 1–5 check-in (soreness and stress are inverted). */
export function readinessScore(r: { energy: number; soreness: number; stress: number; motivation: number }) {
  const s = r.energy + (6 - r.soreness) + (6 - r.stress) + r.motivation; // 4..20
  return Math.round(((s - 4) / 16) * 100);
}

export function readinessAdvice(score: number) {
  if (score >= 70) return { label: "Ready", tone: "good" as const, advice: "You're well recovered. Train as planned and push the top sets." };
  if (score >= 45) return { label: "Steady", tone: "ok" as const, advice: "Train as planned, but keep a rep or two in reserve on every set." };
  return {
    label: "Take it easier",
    tone: "low" as const,
    advice: "Consider a lighter session — fewer sets, lower loads, or an easy walk instead. Rest is part of the plan.",
  };
}
