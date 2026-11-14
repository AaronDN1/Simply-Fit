import type { CardioEntry, DailyLog, FoodEntry, Intake, Snapshot, WorkoutLog } from "../types";
import { generatePlan } from "../plan";
import { emptySets, recommendedSplit } from "../workouts";
import { addDays, lastNDays, todayISO, uid, weekdayIndex } from "../utils";
import { lbToKg } from "../units";

/** Deterministic pseudo-random so the demo looks the same on every load. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const EXAMPLE_INTAKE: Intake = {
  age: 22,
  sex: "male",
  heightCm: 182.9,
  weightKg: lbToKg(170),
  goalWeightKg: lbToKg(160),
  experience: "intermediate",
  liftingDaysPerWeek: 7,
  liftingSessionMinutes: 60,
  cardioMinutesPerWeek: 210,
  averageSteps: 10000,
  sleepHours: 8,
  activityLevel: "light",
  equipment: "full_gym",
  trainingStyle: "hypertrophy",
  dietaryPreferences: [],
  allergies: "",
  mealStructure: "three_plus_snacks",
  goal: "fat_loss",
  customGoal: "",
  weeklyRateKg: lbToKg(1),
  priorities: [],
};

const MEALS: Omit<FoodEntry, "id" | "date" | "createdAt">[][] = [
  [
    { meal: "breakfast", name: "Greek yogurt with berries & granola", quantity: "1 bowl", calories: 380, proteinG: 28, carbsG: 52, fatG: 7, source: "ai" },
    { meal: "lunch", name: "Chicken breast, white rice, broccoli", quantity: "8 oz · 1.5 cups · 1 cup", calories: 720, proteinG: 66, carbsG: 82, fatG: 12, source: "ai" },
    { meal: "snack", name: "Whey protein + banana", quantity: "1 scoop · 1 medium", calories: 225, proteinG: 25, carbsG: 30, fatG: 2, source: "ai" },
    { meal: "dinner", name: "Salmon, sweet potato, salad", quantity: "6 oz · 1 medium · 2 cups", calories: 640, proteinG: 42, carbsG: 45, fatG: 30, source: "ai" },
  ],
  [
    { meal: "breakfast", name: "Eggs, toast, orange juice", quantity: "3 eggs · 2 slices · 1 cup", calories: 560, proteinG: 28, carbsG: 54, fatG: 24, source: "ai" },
    { meal: "lunch", name: "Turkey wrap", quantity: "2 wraps", calories: 640, proteinG: 48, carbsG: 60, fatG: 22, source: "manual" },
    { meal: "dinner", name: "Lean beef pasta", quantity: "5 oz beef · 2 cups pasta", calories: 820, proteinG: 55, carbsG: 92, fatG: 22, source: "ai" },
    { meal: "snack", name: "Cottage cheese & apple", quantity: "1 cup · 1 apple", calories: 285, proteinG: 26, carbsG: 35, fatG: 5, source: "ai" },
  ],
  [
    { meal: "breakfast", name: "Oatmeal with whey and peanut butter", quantity: "1 cup dry · 1 scoop · 1 tbsp", calories: 640, proteinG: 45, carbsG: 72, fatG: 18, source: "ai" },
    { meal: "lunch", name: "Burrito bowl", quantity: "1 bowl", calories: 760, proteinG: 52, carbsG: 85, fatG: 20, source: "ai" },
    { meal: "dinner", name: "Grilled chicken thighs and potatoes", quantity: "6 oz · 300 g", calories: 610, proteinG: 46, carbsG: 60, fatG: 18, source: "ai" },
  ],
];

export function buildDemoSnapshot(id: string, email: string, name: string): Snapshot {
  const rand = rng(42);
  const intake = EXAMPLE_INTAKE;
  const plan = generatePlan(intake);
  const split = recommendedSplit(intake, plan.levers.liftingDays);
  const today = todayISO();
  const days = lastNDays(35, addDays(today, -1));

  const foods: FoodEntry[] = [];
  const cardio: CardioEntry[] = [];
  const daily: DailyLog[] = [];
  const workouts: WorkoutLog[] = [];
  const startKg = lbToKg(174.5);

  days.forEach((date, i) => {
    const template = MEALS[i % MEALS.length];
    if (rand() > 0.12) {
      template.forEach((m) => {
        const jitter = 0.9 + rand() * 0.2;
        foods.push({
          ...m,
          id: uid(),
          date,
          calories: Math.round(m.calories * jitter),
          proteinG: Math.round(m.proteinG * jitter),
          carbsG: Math.round(m.carbsG * jitter),
          fatG: Math.round(m.fatG * jitter),
          createdAt: `${date}T12:00:00.000Z`,
        });
      });
    }
    const trendKg = startKg - (lbToKg(0.9) / 7) * i;
    const noise = (rand() - 0.5) * 1.1;
    daily.push({
      date,
      steps: Math.round(8200 + rand() * 4200),
      stepsSource: "manual",
      sleepHours: Math.round((6.6 + rand() * 1.9) * 4) / 4,
      sleepQuality: 2 + Math.floor(rand() * 4),
      weightKg: rand() > 0.2 ? Math.round((trendKg + noise) * 10) / 10 : null,
      readiness: { energy: 3 + Math.floor(rand() * 3), soreness: 1 + Math.floor(rand() * 3), stress: 1 + Math.floor(rand() * 3), motivation: 3 + Math.floor(rand() * 3) },
    });
    if (rand() > 0.25)
      cardio.push({
        id: uid(),
        date,
        activity: ["Incline walk", "Cycling", "Easy run", "Rower"][Math.floor(rand() * 4)],
        minutes: [20, 25, 30, 35][Math.floor(rand() * 4)],
        intensity: rand() > 0.7 ? "hard" : rand() > 0.3 ? "moderate" : "easy",
        source: "manual",
        createdAt: `${date}T18:00:00.000Z`,
      });

    const day = split.days[weekdayIndex(date)];
    if (!day.isRest && rand() > 0.12) {
      const progress = 1 + i * 0.006;
      const sets = emptySets(day, []).map((s) => {
        const base = BASE_LOADS[s.exerciseId] ?? 20;
        return { ...s, weightKg: Math.round(base * progress * 2) / 2, reps: Math.max(6, s.reps - Math.floor(rand() * 3)), done: true, rpe: 7 + Math.round(rand() * 2) };
      });
      workouts.push({ id: uid(), date, dayId: day.id, dayName: day.name, sets, notes: "", startedAt: `${date}T17:00:00.000Z`, completedAt: `${date}T18:05:00.000Z` });
    }
  });

  return {
    profile: {
      id,
      email,
      displayName: name,
      intake,
      plan,
      split,
      settings: {
        units: { weight: "lb", height: "imperial" },
        notifications: { dailyPlan: true, mealReminders: false, workoutReminders: true, weeklyReview: true },
        privacy: { aiUsesHistory: true, productAnalytics: false },
        legal: { acceptedAt: null, version: null },
        health: { appleHealth: "not_connected", healthConnect: "not_connected", lastSyncAt: null },
        savedMeals: [],
      },
      onboardedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
      createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    },
    foods,
    cardio,
    daily: [...daily, { date: today, steps: 4312, stepsSource: "manual", sleepHours: 7.75, sleepQuality: 4, weightKg: null, readiness: null }],
    workouts,
  };
}

const BASE_LOADS: Record<string, number> = {
  bench_press: 80,
  incline_db: 28,
  ohp: 50,
  lateral_raise: 10,
  pushdown: 30,
  lat_pulldown: 65,
  cable_row: 65,
  pull_up: 0,
  face_pull: 20,
  db_curl: 14,
  back_squat: 100,
  rdl: 90,
  bulgarian: 20,
  leg_curl: 45,
  calf_raise: 0,
  cable_crunch: 35,
  plank: 0,
};
