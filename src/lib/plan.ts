import type { EnergyBreakdown, Goal, Intake, Plan, PlanLevers, Settings } from "./types";
import { clamp, round } from "./utils";
import { displayWeight, formatRate, lbToKg } from "./units";

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

/** Lowest calorie target a plan can use. Below this, the pace is recalculated to match. */
export const MIN_CALORIES = 1000;
/** Highest calorie target a plan can use. Above this, the pace is recalculated to match. */
export const MAX_CALORIES = 7000;

/** Fastest loss the pace control will set. Calorie targets can imply a faster pace. */
export const MAX_RECOMMENDED_LOSS_LB = 2;

export function maxRecommendedLossKg() {
  return -lbToKg(MAX_RECOMMENDED_LOSS_LB);
}

export function recommendedLossLabel(units: Settings["units"]) {
  if (units.weight === "lb") return `${MAX_RECOMMENDED_LOSS_LB} lb`;
  return `${displayWeight(lbToKg(MAX_RECOMMENDED_LOSS_LB), units, 2)} kg`;
}

/** True when the pace the UI would show is faster than the recommended loss. */
export function exceedsRecommendedLoss(kgPerWeek: number, units: Settings["units"]) {
  if (kgPerWeek >= 0) return false;
  const shown = Math.abs(displayWeight(kgPerWeek, units, units.weight === "lb" ? 1 : 2));
  const limit = units.weight === "lb" ? MAX_RECOMMENDED_LOSS_LB : displayWeight(lbToKg(MAX_RECOMMENDED_LOSS_LB), units, 2);
  return shown > limit;
}

export function aggressiveLossMessage(units: Settings["units"]) {
  return `We don't recommend losing faster than ${recommendedLossLabel(units)} a week. Anything more can be harmful and raises the risk of muscle loss.`;
}

/**
 * Fastest gain that still favors muscle. About 0.5% of body weight per week —
 * past that, a larger share of the weight gained is fat.
 */
export function recommendedGainKg(intake: Intake) {
  return round(intake.weightKg * 0.005, 0.01);
}

export function recommendedGainLabel(intake: Intake, units: Settings["units"]) {
  const digits = units.weight === "lb" ? 1 : 2;
  return `${displayWeight(recommendedGainKg(intake), units, digits)} ${units.weight}`;
}

/** True when the pace the UI would show is faster than the recommended gain. */
export function exceedsRecommendedGain(kgPerWeek: number, intake: Intake, units: Settings["units"]) {
  if (kgPerWeek <= 0) return false;
  const digits = units.weight === "lb" ? 1 : 2;
  const shown = displayWeight(kgPerWeek, units, digits);
  const limit = displayWeight(recommendedGainKg(intake), units, digits);
  return shown > limit;
}

export function aggressiveGainMessage(intake: Intake, units: Settings["units"]) {
  return `We don't recommend gaining faster than ${recommendedGainLabel(intake, units)} a week. Past that it isn't optimal, and more of the weight you gain will be fat than muscle.`;
}

/** Bounds for the pace control, in kg (signed). Loss stops at 2 lb/week; gain at ~0.5% of body weight. */
export function rateBounds(intake: Intake) {
  return {
    maxLoss: maxRecommendedLossKg(),
    maxGain: recommendedGainKg(intake),
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
  // The pace control has its own limits. A calorie target between 1,000 and 7,000
  // is kept as-is, and the pace shown is the one that target actually implies.
  let weeklyRateKg = leversIn.weeklyRateKg;
  const activity = {
    stepTarget: clamp(round(leversIn.stepTarget, 500), 3000, 25000),
    cardioMinutesPerWeek: clamp(round(leversIn.cardioMinutesPerWeek, 10), 0, 600),
    liftingDays: clamp(Math.round(leversIn.liftingDays), 0, 7),
  };

  const breakdown = energyBreakdown(intake, activity);
  const maintenance = maintenanceFrom(breakdown);
  let target = maintenance + (weeklyRateKg * KCAL_PER_KG) / 7;
  if (target < MIN_CALORIES) {
    target = MIN_CALORIES;
    weeklyRateKg = ((target - maintenance) * 7) / KCAL_PER_KG;
    warnings.push(`Calories stay at ${MIN_CALORIES.toLocaleString()} — the lowest available — so the pace matches that intake.`);
  } else if (target > MAX_CALORIES) {
    target = MAX_CALORIES;
    weeklyRateKg = ((target - maintenance) * 7) / KCAL_PER_KG;
  }
  weeklyRateKg = round(weeklyRateKg, 0.01);
  target = clamp(round(target, 10), MIN_CALORIES, MAX_CALORIES);
  const levers: PlanLevers = { weeklyRateKg, ...activity };

  const refKg = referenceWeightKg(intake);
  // 1 g/lb is about 2.2 g/kg. These sit a step under that: ~0.95, ~0.91, and ~0.82 g/lb.
  const proteinPerKg = intake.goal === "fat_loss" || intake.goal === "recomp" ? 2.1 : intake.goal === "muscle_gain" ? 2.0 : 1.8;
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
      exceedsRecommendedLoss(levers.weeklyRateKg, units)
        ? `Eating ${target.toLocaleString()} creates a ~${round(maintenance - target, 10)} calorie daily gap, about ${fmtW(levers.weeklyRateKg)} per week — faster than the ${recommendedLossLabel(units)} a week we recommend.`
        : `Eating ${target.toLocaleString()} creates a ~${round(maintenance - target, 10)} calorie daily gap, which works out to about ${fmtW(levers.weeklyRateKg)} per week. That pace is sustainable and protects muscle.`
    );
  else if (levers.weeklyRateKg > 0.01)
    explanation.push(
      exceedsRecommendedGain(levers.weeklyRateKg, intake, units)
        ? `Eating ${target.toLocaleString()} gives a ~${round(target - maintenance, 10)} calorie surplus — about ${fmtW(levers.weeklyRateKg)} per week, faster than the ${recommendedGainLabel(intake, units)} a week we recommend.`
        : `Eating ${target.toLocaleString()} gives a ~${round(target - maintenance, 10)} calorie surplus — about ${fmtW(levers.weeklyRateKg)} per week, which favors muscle over fat gain.`
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
    macrosCustomized: false,
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

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function caloriesForMacros(macros: MacroTargets) {
  return macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9;
}

/** Applies user-selected macros and recalculates the implied calorie target and pace. */
export function applyMacroTargets(intake: Intake, plan: Plan, macros: MacroTargets, units?: Settings["units"]): Plan {
  const calorieTarget = round(caloriesForMacros(macros), 10);
  // Keep the pace honest, including when the total implies a loss faster than 2 lb/week.
  const weeklyRateKg = round(rateForCalories(intake, plan.levers, calorieTarget), 0.01);
  const next: Plan = {
    ...plan,
    levers: { ...plan.levers, weeklyRateKg: round(weeklyRateKg, 0.01) },
    calorieTarget,
    proteinG: round(macros.proteinG, 1),
    carbsG: round(macros.carbsG, 1),
    fatG: round(macros.fatG, 1),
    macrosCustomized: true,
    generatedAt: new Date().toISOString(),
  };
  const rateText = formatRate(next.levers.weeklyRateKg, units ?? { weight: "lb", height: "imperial" });
  next.explanation = [
    ...plan.explanation.filter((line) => !line.startsWith("Macros are manually set")),
    `Macros are manually set to ${next.proteinG} g protein, ${next.carbsG} g carbs, and ${next.fatG} g fat (${calorieTarget.toLocaleString()} kcal). That implies a pace of ${rateText} at your current activity and maintenance estimate.`,
  ];
  return next;
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
