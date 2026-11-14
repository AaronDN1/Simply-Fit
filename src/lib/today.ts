import type { Snapshot } from "./types";
import { cardioMinutesOn, dailyFor, plannedCardioOn, totalsFor } from "./stats";
import { dayForDate } from "./workouts";
import { readinessAdvice, readinessScore } from "./plan";

export type ActionKey = "checkin" | "meals" | "workout" | "cardio" | "steps" | "weigh";

export interface TodayAction {
  key: ActionKey;
  title: string;
  detail: string;
  done: boolean;
  optional?: boolean;
  href: string;
}

function expectedMeals(structure: string | undefined, hour: number) {
  const slots = structure === "two_meals" ? [12, 19] : [9, 13, 19];
  return slots.filter((h) => hour >= h).length;
}

/** Builds today's checklist and picks the single most useful next action. */
export function todayPlan(data: Snapshot, date: string, now = new Date()) {
  const { profile, foods, cardio, daily, workouts } = data;
  const plan = profile.plan!;
  const hour = now.getHours();
  const totals = totalsFor(foods, date);
  const log = dailyFor(daily, date);
  const day = dayForDate(profile.split, date);
  const workoutLog = workouts.find((w) => w.date === date);
  const workoutDone = Boolean(workoutLog?.completedAt);
  const plannedCardio = plannedCardioOn(plan, profile.split, date);
  const doneCardio = cardioMinutesOn(cardio, date);
  const steps = log?.steps ?? 0;
  const mealCount = new Set(foods.filter((f) => f.date === date).map((f) => f.meal)).size;
  const remaining = plan.calorieTarget - totals.calories;

  const actions: TodayAction[] = [];
  actions.push({
    key: "checkin",
    title: "Morning check-in",
    detail: log?.readiness ? readinessAdvice(readinessScore(log.readiness)).label : "10 seconds — energy, soreness, stress",
    done: Boolean(log?.readiness),
    href: "/activity#recovery",
  });
  actions.push({
    key: "meals",
    title: "Log your meals",
    detail: totals.calories ? `${Math.max(0, Math.round(remaining)).toLocaleString()} kcal left · ${Math.max(0, Math.round(plan.proteinG - totals.proteinG))} g protein to go` : `${plan.calorieTarget.toLocaleString()} kcal · ${plan.proteinG} g protein`,
    done: totals.calories >= plan.calorieTarget * 0.85,
    href: "/nutrition",
  });
  if (day && !day.isRest)
    actions.push({
      key: "workout",
      title: day.name,
      detail: workoutDone ? "Completed" : workoutLog ? `In progress · ${workoutLog.sets.filter((s) => s.done).length}/${workoutLog.sets.length} sets` : `${day.exercises.length} exercises · ${day.focus}`,
      done: workoutDone,
      href: "/training",
    });
  else
    actions.push({ key: "workout", title: "Rest day", detail: "Recovery is part of the plan. A walk counts.", done: true, optional: true, href: "/training" });
  if (plannedCardio > 0)
    actions.push({
      key: "cardio",
      title: `${plannedCardio} min cardio`,
      detail: doneCardio ? `${doneCardio} of ${plannedCardio} min done` : "Easy to moderate pace",
      done: doneCardio >= plannedCardio,
      href: "/activity#cardio",
    });
  actions.push({
    key: "steps",
    title: `${plan.levers.stepTarget.toLocaleString()} steps`,
    detail: steps ? `${steps.toLocaleString()} so far · ${Math.max(0, plan.levers.stepTarget - steps).toLocaleString()} to go` : "Log today's steps",
    done: steps >= plan.levers.stepTarget,
    href: "/activity#steps",
  });
  actions.push({
    key: "weigh",
    title: "Weigh in",
    detail: log?.weightKg ? "Logged" : "Optional — morning, after the bathroom",
    done: Boolean(log?.weightKg),
    optional: true,
    href: "/progress",
  });

  // Next best action: time-aware priority.
  const pending = actions.filter((a) => !a.done);
  const behindOnMeals = mealCount < expectedMeals(profile.intake?.mealStructure, hour);
  const order: ActionKey[] =
    hour < 11
      ? ["checkin", "meals", "weigh", "workout", "cardio", "steps"]
      : hour < 16
        ? [behindOnMeals ? "meals" : "workout", "workout", "meals", "checkin", "cardio", "steps"]
        : ["workout", "meals", "cardio", "steps", "checkin"];
  const next = order.map((k) => pending.find((a) => a.key === k)).find(Boolean) ?? null;

  const required = actions.filter((a) => !a.optional);
  const progress = required.length ? required.filter((a) => a.done).length / required.length : 1;

  return { actions, next, progress, totals, day, workoutLog, workoutDone, plannedCardio, doneCardio, steps, log, remaining };
}

export function nextActionCopy(key: ActionKey | undefined, ctx: { remaining: number; mealHint: string; dayName?: string }) {
  switch (key) {
    case "checkin":
      return { title: "Start with a quick check-in", body: "How you feel today shapes how hard to push. It takes ten seconds.", cta: "Check in" };
    case "meals":
      return { title: `Log ${ctx.mealHint}`, body: "Just type what you ate — we'll handle the numbers.", cta: "Log a meal" };
    case "workout":
      return { title: `Time for ${ctx.dayName ?? "your workout"}`, body: "Your sets and suggested weights are ready.", cta: "Start workout" };
    case "cardio":
      return { title: "Fit in your cardio", body: "An easy session counts. Log it when you're done.", cta: "Log cardio" };
    case "steps":
      return { title: "Get a walk in", body: "A 15-minute walk is about 1,800 steps.", cta: "Update steps" };
    case "weigh":
      return { title: "Optional weigh-in", body: "Daily weigh-ins feed a smoother trend. One number never tells the story.", cta: "Log weight" };
    default:
      return { title: "Today's plan is done", body: "Nice work. Rest up — tomorrow's plan will be ready when you are.", cta: "See progress" };
  }
}
