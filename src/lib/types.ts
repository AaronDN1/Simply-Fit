export type Sex = "male" | "female" | "unspecified";
export type Goal =
  | "fat_loss"
  | "muscle_gain"
  | "maintenance"
  | "recomp"
  | "endurance"
  | "general_health"
  | "custom";
export type Experience = "new" | "intermediate" | "advanced";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type EquipmentAccess = "full_gym" | "home_gym" | "home_dumbbells" | "bodyweight";
export type MealStructure = "three_meals" | "three_plus_snacks" | "two_meals" | "flexible";
export type TrainingStyle = "strength" | "hypertrophy" | "general" | "athletic";
export type Priority = "more_food" | "less_cardio" | "fewer_days" | "faster";
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export type Intensity = "easy" | "moderate" | "hard";
export type DataSource = "manual" | "apple_health" | "health_connect" | "ai";

/** All body measurements are stored metric; display units are a setting. */
export interface Intake {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number | null;
  experience: Experience;
  liftingDaysPerWeek: number;
  liftingSessionMinutes: number;
  cardioMinutesPerWeek: number;
  averageSteps: number;
  sleepHours: number;
  activityLevel: ActivityLevel;
  equipment: EquipmentAccess;
  trainingStyle: TrainingStyle;
  dietaryPreferences: string[];
  allergies: string;
  mealStructure: MealStructure;
  goal: Goal;
  customGoal: string;
  /** Desired weekly change magnitude in kg (always >= 0; direction comes from the goal). */
  weeklyRateKg: number;
  priorities: Priority[];
}

/** The things a user can trade off against each other. */
export interface PlanLevers {
  /** Signed: negative = losing weight. */
  weeklyRateKg: number;
  stepTarget: number;
  cardioMinutesPerWeek: number;
  liftingDays: number;
}

export interface EnergyBreakdown {
  bmr: number;
  baseline: number;
  steps: number;
  lifting: number;
  cardio: number;
  lifestyle: number;
}

export interface Plan {
  levers: PlanLevers;
  maintenanceCalories: number;
  calorieTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  macrosCustomized?: boolean;
  sleepTargetHours: number;
  breakdown: EnergyBreakdown;
  recovery: string[];
  explanation: string[];
  warnings: string[];
  generatedAt: string;
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  quantity: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: "ai" | "manual";
  createdAt: string;
}

export interface SavedMeal {
  id: string;
  name: string;
  meal: Meal;
  items: Omit<FoodEntry, "id" | "date" | "meal" | "source" | "createdAt">[];
  createdAt: string;
}

export interface CardioEntry {
  id: string;
  date: string;
  activity: string;
  minutes: number;
  intensity: Intensity;
  source: DataSource;
  createdAt: string;
}

export interface Readiness {
  energy: number;
  soreness: number;
  stress: number;
  motivation: number;
}

export interface DailyLog {
  date: string;
  steps: number | null;
  stepsSource: DataSource | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  weightKg: number | null;
  readiness: Readiness | null;
}

export interface PlannedExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  rpe: number;
  restSec: number;
  weightKg: number | null;
  notes: string;
}

export interface WorkoutDay {
  id: string;
  name: string;
  focus: string;
  isRest: boolean;
  exercises: PlannedExercise[];
}

/** A weekly split: days[0] is Monday … days[6] is Sunday. */
export interface Split {
  id: string;
  name: string;
  source: "recommended" | "custom" | "ai";
  days: WorkoutDay[];
  rotation?: {
    startDate: string;
    days: WorkoutDay[];
  };
}

export interface SetLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  done: boolean;
}

export interface WorkoutLog {
  id: string;
  date: string;
  dayId: string;
  dayName: string;
  sets: SetLog[];
  notes: string;
  startedAt: string;
  completedAt: string | null;
}

export type HealthStatus = "not_connected" | "connected" | "unavailable";

/** `granted` is complimentary access from an admin. Paid tiers come from Stripe. */
export interface AccountAccess {
  disabledAt: string | null;
  plan: "none" | "free" | "paid" | "unlimited" | "granted";
}

export interface BillingState {
  customerId: string | null;
  subscriptionId: string | null;
  status: "none" | "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  disputed: boolean;
  refunded: boolean;
  fraudWarning: boolean;
}

export interface Settings {
  units: { weight: "lb" | "kg"; height: "imperial" | "metric" };
  notifications: {
    dailyPlan: boolean;
    mealReminders: boolean;
    workoutReminders: boolean;
    weeklyReview: boolean;
  };
  privacy: { aiUsesHistory: boolean; productAnalytics: boolean };
  /** Set when the person accepts the current terms and privacy policy. */
  legal: { acceptedAt: string | null; version: string | null };
  health: { appleHealth: HealthStatus; healthConnect: HealthStatus; lastSyncAt: string | null };
  savedMeals: SavedMeal[];
  access?: AccountAccess;
  billing?: BillingState;
}

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  intake: Intake | null;
  plan: Plan | null;
  split: Split | null;
  settings: Settings;
  onboardedAt: string | null;
  createdAt: string;
}

export interface Snapshot {
  profile: Profile;
  foods: FoodEntry[];
  cardio: CardioEntry[];
  daily: DailyLog[];
  workouts: WorkoutLog[];
}

export const defaultSettings: Settings = {
  units: { weight: "lb", height: "imperial" },
  notifications: { dailyPlan: true, mealReminders: false, workoutReminders: true, weeklyReview: true },
  privacy: { aiUsesHistory: true, productAnalytics: false },
  legal: { acceptedAt: null, version: null },
  health: { appleHealth: "not_connected", healthConnect: "not_connected", lastSyncAt: null },
  savedMeals: [],
  access: { disabledAt: null, plan: "none" },
};
