import type { CardioEntry, DailyLog, FoodEntry, Plan, Profile, Settings, Split, WorkoutLog } from "./types";
import { addDays, lastNDays, toISODate, todayISO, weekdayIndex } from "./utils";
import { displayWeight } from "./units";
import { dayForDate, trainedExercises, exerciseHistory } from "./workouts";

export interface DayTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  meals: number;
}

export function totalsFor(foods: FoodEntry[], date: string): DayTotals {
  const day = foods.filter((f) => f.date === date);
  return {
    calories: day.reduce((s, f) => s + f.calories, 0),
    proteinG: day.reduce((s, f) => s + f.proteinG, 0),
    carbsG: day.reduce((s, f) => s + f.carbsG, 0),
    fatG: day.reduce((s, f) => s + f.fatG, 0),
    meals: new Set(day.map((f) => f.meal)).size,
  };
}

export function cardioMinutesOn(cardio: CardioEntry[], date: string) {
  return cardio.filter((c) => c.date === date).reduce((s, c) => s + c.minutes, 0);
}

export function cardioMinutesWeek(cardio: CardioEntry[], end = todayISO()) {
  const days = new Set(lastNDays(7, end));
  return cardio.filter((c) => days.has(c.date)).reduce((s, c) => s + c.minutes, 0);
}

/** Planned cardio for a given day: spread the weekly target over non-rest days first. */
export function plannedCardioOn(plan: Plan | null, split: Split | null, date: string) {
  if (!plan) return 0;
  const weekly = plan.levers.cardioMinutesPerWeek;
  if (!weekly) return 0;
  const sessions = Math.min(7, Math.max(2, Math.round(weekly / 30)));
  const per = Math.round(weekly / sessions / 5) * 5;
  // Prefer rest days first, then lighter days, so cardio doesn't stack on hard lifting days.
  const order = split
    ? [...split.days.map((d, i) => ({ i, rest: d.isRest }))].sort((a, b) => Number(b.rest) - Number(a.rest)).map((x) => x.i)
    : [0, 2, 4, 6, 1, 3, 5];
  const chosen = new Set(order.slice(0, sessions));
  return chosen.has(weekdayIndex(date)) ? per : 0;
}

export function dailyFor(daily: DailyLog[], date: string) {
  return daily.find((d) => d.date === date) ?? null;
}

export function latest<T extends keyof DailyLog>(daily: DailyLog[], key: T, before = todayISO()) {
  const sorted = daily.filter((d) => d.date <= before && d[key] != null).sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0] ? { date: sorted[0].date, value: sorted[0][key] as NonNullable<DailyLog[T]> } : null;
}

/** Weight series with a 7-day rolling average (only days with entries). */
export function weightSeries(daily: DailyLog[], days = 56) {
  const range = lastNDays(days);
  const byDate = new Map(daily.filter((d) => d.weightKg != null).map((d) => [d.date, d.weightKg as number]));
  const out: { date: string; weight: number | null; avg: number | null }[] = [];
  for (const date of range) {
    const window = lastNDays(7, date)
      .map((d) => byDate.get(d))
      .filter((v): v is number => v != null);
    out.push({ date, weight: byDate.get(date) ?? null, avg: window.length ? window.reduce((a, b) => a + b, 0) / window.length : null });
  }
  return out;
}

/** Weekly trend (kg/week) from linear regression over the rolling average. */
export function weightTrend(daily: DailyLog[], days = 21) {
  const pts = weightSeries(daily, days)
    .map((p, i) => ({ x: i, y: p.avg }))
    .filter((p): p is { x: number; y: number } => p.y != null);
  if (pts.length < 4) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const num = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (!den) return null;
  return (num / den) * 7;
}

export function nutritionAdherence(foods: FoodEntry[], plan: Plan | null, days = 7) {
  const range = lastNDays(days, addDays(todayISO(), -1));
  let logged = 0;
  let onTarget = 0;
  let proteinHit = 0;
  const calories: number[] = [];
  const protein: number[] = [];
  for (const d of range) {
    const t = totalsFor(foods, d);
    calories.push(t.calories);
    protein.push(t.proteinG);
    if (t.calories < 300) continue;
    logged++;
    if (plan && Math.abs(t.calories - plan.calorieTarget) <= plan.calorieTarget * 0.1) onTarget++;
    if (plan && t.proteinG >= plan.proteinG * 0.9) proteinHit++;
  }
  return { range, logged, onTarget, proteinHit, calories, protein };
}

export function workoutCompletion(logs: WorkoutLog[], split: Split | null, days = 28, since?: string | null) {
  const start = since ? toISODate(new Date(since)) : null;
  const range = lastNDays(days).filter((d) => !start || d >= start);
  let scheduled = 0;
  let completed = 0;
  for (const d of range) {
    const day = dayForDate(split, d);
    const done = logs.some((l) => l.date === d && l.completedAt);
    if (day && !day.isRest) {
      if (!done && d === todayISO()) continue;
      scheduled++;
      if (done) completed++;
    } else if (done) completed++;
  }
  return { scheduled, completed, rate: scheduled ? Math.min(1, completed / scheduled) : 0 };
}

export function stepSeries(daily: DailyLog[], days = 14) {
  return lastNDays(days).map((d) => dailyFor(daily, d)?.steps ?? null);
}

export function sleepSeries(daily: DailyLog[], days = 14) {
  return lastNDays(days).map((d) => dailyFor(daily, d)?.sleepHours ?? null);
}

export function average(values: (number | null)[]) {
  const v = values.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function strengthHighlights(logs: WorkoutLog[], limit = 4) {
  return trainedExercises(logs)
    .slice(0, limit)
    .map((ex) => {
      const hist = exerciseHistory(logs, ex.id);
      const first = hist[0];
      const last = hist[hist.length - 1];
      const best = hist.reduce((m, p) => Math.max(m, p.bestE1rm), 0);
      return {
        ...ex,
        series: hist.map((h) => h.bestE1rm),
        best,
        change: first && last && hist.length > 1 ? (last.bestE1rm - first.bestE1rm) / first.bestE1rm : 0,
      };
    });
}

export function projectGoal(profile: Profile, daily: DailyLog[]) {
  const goal = profile.intake?.goalWeightKg;
  const currentEntry = latest(daily, "weightKg");
  const current = currentEntry?.value ?? profile.intake?.weightKg;
  if (!goal || !current) return null;
  const diff = goal - current;
  if (Math.abs(diff) < 0.3) return { reached: true as const, weeks: 0, basis: "plan" as const, current, goal };
  const trend = weightTrend(daily);
  const usable = trend && Math.sign(trend) === Math.sign(diff) && Math.abs(trend) > 0.05 ? trend : null;
  const pace = usable ?? profile.plan?.levers.weeklyRateKg ?? 0;
  if (!pace || Math.sign(pace) !== Math.sign(diff)) return { reached: false as const, weeks: null, basis: "plan" as const, current, goal };
  const weeks = Math.ceil(Math.abs(diff / pace));
  return { reached: false as const, weeks, basis: usable ? ("trend" as const) : ("plan" as const), current, goal };
}

/** A short, plain-language, non-judgmental weekly review. */
export function weeklyReview(
  profile: Profile,
  data: { foods: FoodEntry[]; cardio: CardioEntry[]; daily: DailyLog[]; workouts: WorkoutLog[] },
  units: Settings["units"]
) {
  const plan = profile.plan;
  const lines: { title: string; body: string }[] = [];
  const n = nutritionAdherence(data.foods, plan, 7);
  const w = workoutCompletion(data.workouts, profile.split, 7, profile.onboardedAt);
  const steps = average(stepSeries(data.daily, 7));
  const sleep = average(sleepSeries(data.daily, 7));
  const trend = weightTrend(data.daily, 14);

  const wins: string[] = [];
  if (w.completed) wins.push(`${w.completed} workout${w.completed === 1 ? "" : "s"} completed`);
  if (n.proteinHit >= 4) wins.push(`protein target hit ${n.proteinHit} days`);
  if (plan && steps && steps >= plan.levers.stepTarget * 0.95) wins.push(`steps averaged ${Math.round(steps).toLocaleString()}`);
  if (plan && sleep && sleep >= plan.sleepTargetHours - 0.25) wins.push(`sleep averaged ${sleep.toFixed(1)} h`);
  lines.push({
    title: "What went well",
    body: wins.length
      ? `${capitalize(wins.join(", "))}. That's the kind of consistency that compounds.`
      : "This week was light on logged data — that's okay. Logging even a few meals and one workout next week will make the picture clearer.",
  });

  if (trend != null && plan) {
    const t = displayWeight(trend, units, 2);
    const p = plan.levers.weeklyRateKg;
    const diff = trend - p;
    let body = `Your 7-day average is moving about ${t > 0 ? "+" : ""}${t} ${units.weight}/week. `;
    if (Math.abs(diff) < 0.15) body += "That's right in line with your plan.";
    else if ((p < 0 && trend > p) || (p > 0 && trend < p))
      body += "That's a bit slower than planned. Water and digestion can mask progress for a week or two, so give it another week before changing anything.";
    else body += "That's a bit faster than planned. If energy or training feels flat, adding ~100–150 calories is a reasonable move.";
    lines.push({ title: "Weight trend", body });
  }

  const focus: string[] = [];
  if (plan && n.logged >= 3 && n.proteinHit < 4) focus.push(`build meals around a protein source to reach ${plan.proteinG} g more often`);
  if (w.scheduled && w.completed < w.scheduled) focus.push(`protect ${w.scheduled - w.completed === 1 ? "one more" : "a couple more"} training session${w.scheduled - w.completed === 1 ? "" : "s"} — shorter workouts still count`);
  if (plan && sleep && sleep < plan.sleepTargetHours - 0.5) focus.push(`move bedtime 20–30 minutes earlier`);
  if (plan && steps && steps < plan.levers.stepTarget * 0.8) focus.push(`add a 10-minute walk after one meal a day`);
  lines.push({
    title: "One focus for next week",
    body: focus.length ? `${capitalize(focus[0])}.` : "Keep doing what you're doing. No changes needed.",
  });
  return lines;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
