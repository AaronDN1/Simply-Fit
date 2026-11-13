import type { EquipmentAccess, Intake, PlannedExercise, SetLog, Split, TrainingStyle, WorkoutDay, WorkoutLog } from "./types";
import { uid, weekdayIndex } from "./utils";

export type Tool = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "bench" | "pullup_bar" | "band" | "kettlebell";
export type Pattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "horizontal_press"
  | "incline_press"
  | "vertical_press"
  | "horizontal_pull"
  | "vertical_pull"
  | "lateral_raise"
  | "biceps"
  | "triceps"
  | "quad_iso"
  | "hamstring_iso"
  | "calves"
  | "core"
  | "glutes"
  | "rear_delt";

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  tools: Tool[];
  compound: boolean;
}

export const EXERCISES: Exercise[] = [
  { id: "back_squat", name: "Back squat", pattern: "squat", tools: ["barbell"], compound: true },
  { id: "goblet_squat", name: "Goblet squat", pattern: "squat", tools: ["dumbbell"], compound: true },
  { id: "leg_press", name: "Leg press", pattern: "squat", tools: ["machine"], compound: true },
  { id: "hack_squat", name: "Hack squat", pattern: "squat", tools: ["machine"], compound: true },
  { id: "bw_squat", name: "Tempo bodyweight squat", pattern: "squat", tools: ["bodyweight"], compound: true },
  { id: "rdl", name: "Romanian deadlift", pattern: "hinge", tools: ["barbell"], compound: true },
  { id: "db_rdl", name: "Dumbbell Romanian deadlift", pattern: "hinge", tools: ["dumbbell"], compound: true },
  { id: "deadlift", name: "Deadlift", pattern: "hinge", tools: ["barbell"], compound: true },
  { id: "kb_swing", name: "Kettlebell swing", pattern: "hinge", tools: ["kettlebell"], compound: true },
  { id: "sl_hip_hinge", name: "Single-leg hip hinge", pattern: "hinge", tools: ["bodyweight"], compound: true },
  { id: "bulgarian", name: "Bulgarian split squat", pattern: "lunge", tools: ["dumbbell"], compound: true },
  { id: "walking_lunge", name: "Walking lunge", pattern: "lunge", tools: ["bodyweight"], compound: true },
  { id: "bench_press", name: "Bench press", pattern: "horizontal_press", tools: ["barbell", "bench"], compound: true },
  { id: "db_bench", name: "Dumbbell bench press", pattern: "horizontal_press", tools: ["dumbbell", "bench"], compound: true },
  { id: "machine_chest", name: "Machine chest press", pattern: "horizontal_press", tools: ["machine"], compound: true },
  { id: "push_up", name: "Push-up", pattern: "horizontal_press", tools: ["bodyweight"], compound: true },
  { id: "incline_db", name: "Incline dumbbell press", pattern: "incline_press", tools: ["dumbbell", "bench"], compound: true },
  { id: "incline_bench", name: "Incline bench press", pattern: "incline_press", tools: ["barbell", "bench"], compound: true },
  { id: "decline_push_up", name: "Feet-elevated push-up", pattern: "incline_press", tools: ["bodyweight"], compound: true },
  { id: "ohp", name: "Overhead press", pattern: "vertical_press", tools: ["barbell"], compound: true },
  { id: "db_shoulder", name: "Seated dumbbell shoulder press", pattern: "vertical_press", tools: ["dumbbell"], compound: true },
  { id: "pike_push_up", name: "Pike push-up", pattern: "vertical_press", tools: ["bodyweight"], compound: true },
  { id: "barbell_row", name: "Barbell row", pattern: "horizontal_pull", tools: ["barbell"], compound: true },
  { id: "db_row", name: "One-arm dumbbell row", pattern: "horizontal_pull", tools: ["dumbbell"], compound: true },
  { id: "cable_row", name: "Seated cable row", pattern: "horizontal_pull", tools: ["cable"], compound: true },
  { id: "band_row", name: "Band row", pattern: "horizontal_pull", tools: ["band"], compound: true },
  { id: "inverted_row", name: "Inverted row", pattern: "horizontal_pull", tools: ["bodyweight"], compound: true },
  { id: "pull_up", name: "Pull-up", pattern: "vertical_pull", tools: ["pullup_bar"], compound: true },
  { id: "lat_pulldown", name: "Lat pulldown", pattern: "vertical_pull", tools: ["cable"], compound: true },
  { id: "band_pulldown", name: "Band pulldown", pattern: "vertical_pull", tools: ["band"], compound: true },
  { id: "lateral_raise", name: "Dumbbell lateral raise", pattern: "lateral_raise", tools: ["dumbbell"], compound: false },
  { id: "cable_lateral", name: "Cable lateral raise", pattern: "lateral_raise", tools: ["cable"], compound: false },
  { id: "band_lateral", name: "Band lateral raise", pattern: "lateral_raise", tools: ["band"], compound: false },
  { id: "face_pull", name: "Face pull", pattern: "rear_delt", tools: ["cable"], compound: false },
  { id: "rear_delt_fly", name: "Rear-delt fly", pattern: "rear_delt", tools: ["dumbbell"], compound: false },
  { id: "band_pull_apart", name: "Band pull-apart", pattern: "rear_delt", tools: ["band"], compound: false },
  { id: "db_curl", name: "Dumbbell curl", pattern: "biceps", tools: ["dumbbell"], compound: false },
  { id: "cable_curl", name: "Cable curl", pattern: "biceps", tools: ["cable"], compound: false },
  { id: "band_curl", name: "Band curl", pattern: "biceps", tools: ["band"], compound: false },
  { id: "pushdown", name: "Triceps pushdown", pattern: "triceps", tools: ["cable"], compound: false },
  { id: "oh_ext", name: "Overhead dumbbell extension", pattern: "triceps", tools: ["dumbbell"], compound: false },
  { id: "bench_dip", name: "Bench dip", pattern: "triceps", tools: ["bodyweight"], compound: false },
  { id: "leg_extension", name: "Leg extension", pattern: "quad_iso", tools: ["machine"], compound: false },
  { id: "split_squat_iso", name: "Split squat (slow tempo)", pattern: "quad_iso", tools: ["bodyweight"], compound: false },
  { id: "leg_curl", name: "Leg curl", pattern: "hamstring_iso", tools: ["machine"], compound: false },
  { id: "nordic", name: "Nordic curl (assisted)", pattern: "hamstring_iso", tools: ["bodyweight"], compound: false },
  { id: "hip_thrust", name: "Hip thrust", pattern: "glutes", tools: ["barbell", "bench"], compound: true },
  { id: "glute_bridge", name: "Glute bridge", pattern: "glutes", tools: ["bodyweight"], compound: false },
  { id: "calf_raise", name: "Standing calf raise", pattern: "calves", tools: ["bodyweight"], compound: false },
  { id: "plank", name: "Plank", pattern: "core", tools: ["bodyweight"], compound: false },
  { id: "cable_crunch", name: "Cable crunch", pattern: "core", tools: ["cable"], compound: false },
  { id: "dead_bug", name: "Dead bug", pattern: "core", tools: ["bodyweight"], compound: false },
];

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export const TOOLS_FOR: Record<EquipmentAccess, Tool[]> = {
  full_gym: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "bench", "pullup_bar", "band", "kettlebell"],
  home_gym: ["barbell", "dumbbell", "bodyweight", "bench", "pullup_bar", "band", "kettlebell"],
  home_dumbbells: ["dumbbell", "bodyweight", "band"],
  bodyweight: ["bodyweight", "band"],
};

export const EQUIPMENT_LABEL: Record<EquipmentAccess, string> = {
  full_gym: "Full gym",
  home_gym: "Home gym (barbell & rack)",
  home_dumbbells: "Dumbbells at home",
  bodyweight: "Bodyweight / bands only",
};

function available(ex: Exercise, tools: Tool[]) {
  return ex.tools.every((t) => tools.includes(t));
}

export function pickExercise(pattern: Pattern, tools: Tool[], avoid: string[] = []) {
  return EXERCISES.find((e) => e.pattern === pattern && available(e, tools) && !avoid.includes(e.id)) ?? EXERCISES.find((e) => e.pattern === pattern && available(e, tools)) ?? null;
}

/** Alternatives for the same movement pattern, available equipment first. */
export function swapOptions(exerciseId: string, tools?: Tool[]) {
  const ex = EXERCISE_BY_ID[exerciseId];
  if (!ex) return [];
  const same = EXERCISES.filter((e) => e.pattern === ex.pattern && e.id !== ex.id);
  if (!tools) return same;
  return [...same.filter((e) => available(e, tools)), ...same.filter((e) => !available(e, tools))];
}

const SCHEMES: Record<TrainingStyle, { compound: [number, number, number, number, number]; accessory: [number, number, number, number, number] }> = {
  // [sets, repsMin, repsMax, rpe, rest]
  strength: { compound: [4, 4, 6, 8, 180], accessory: [3, 8, 10, 8, 90] },
  hypertrophy: { compound: [3, 6, 10, 8, 150], accessory: [3, 10, 15, 8.5, 75] },
  general: { compound: [3, 8, 10, 7, 120], accessory: [2, 10, 15, 7.5, 60] },
  athletic: { compound: [4, 3, 5, 7.5, 150], accessory: [3, 8, 12, 7.5, 75] },
};

export function plannedFrom(ex: Exercise, style: TrainingStyle): PlannedExercise {
  const [sets, repsMin, repsMax, rpe, restSec] = SCHEMES[style][ex.compound ? "compound" : "accessory"];
  return { id: uid(), exerciseId: ex.id, name: ex.name, sets, repsMin, repsMax, rpe, restSec, weightKg: null, notes: "" };
}

const TEMPLATES: Record<string, { name: string; focus: string; patterns: Pattern[] }> = {
  fullA: { name: "Full body A", focus: "Squat, press, row", patterns: ["squat", "horizontal_press", "horizontal_pull", "lateral_raise", "hamstring_iso", "core"] },
  fullB: { name: "Full body B", focus: "Hinge, overhead, pull-up", patterns: ["hinge", "vertical_press", "vertical_pull", "lunge", "biceps", "triceps"] },
  fullC: { name: "Full body C", focus: "Single-leg, incline, row", patterns: ["lunge", "incline_press", "horizontal_pull", "glutes", "rear_delt", "core"] },
  upperA: { name: "Upper A", focus: "Chest & back strength", patterns: ["horizontal_press", "horizontal_pull", "vertical_press", "vertical_pull", "triceps", "biceps"] },
  lowerA: { name: "Lower A", focus: "Squat focus", patterns: ["squat", "hinge", "quad_iso", "calves", "core"] },
  upperB: { name: "Upper B", focus: "Shoulders & arms", patterns: ["incline_press", "vertical_pull", "horizontal_pull", "lateral_raise", "rear_delt", "biceps"] },
  lowerB: { name: "Lower B", focus: "Hinge focus", patterns: ["hinge", "lunge", "hamstring_iso", "glutes", "calves"] },
  push: { name: "Push", focus: "Chest, shoulders, triceps", patterns: ["horizontal_press", "incline_press", "vertical_press", "lateral_raise", "triceps"] },
  pull: { name: "Pull", focus: "Back, rear delts, biceps", patterns: ["vertical_pull", "horizontal_pull", "rear_delt", "biceps", "core"] },
  legs: { name: "Legs", focus: "Quads, hamstrings, glutes", patterns: ["squat", "hinge", "lunge", "hamstring_iso", "calves"] },
};

const LAYOUTS: Record<number, (keyof typeof TEMPLATES | null)[]> = {
  1: ["fullA", null, null, null, null, null, null],
  2: ["fullA", null, null, "fullB", null, null, null],
  3: ["fullA", null, "fullB", null, "fullC", null, null],
  4: ["upperA", "lowerA", null, "upperB", "lowerB", null, null],
  5: ["upperA", "lowerA", null, "push", "pull", "legs", null],
  6: ["push", "pull", "legs", "push", "pull", "legs", null],
  7: ["push", "pull", "legs", "upperB", "lowerB", "fullC", "fullA"],
};

export function restDay(): WorkoutDay {
  return { id: uid(), name: "Rest", focus: "Recover — an easy walk counts", isRest: true, exercises: [] };
}

export function buildDay(key: keyof typeof TEMPLATES, equipment: EquipmentAccess, style: TrainingStyle): WorkoutDay {
  const t = TEMPLATES[key];
  const tools = TOOLS_FOR[equipment];
  const used: string[] = [];
  const exercises: PlannedExercise[] = [];
  for (const p of t.patterns) {
    const ex = pickExercise(p, tools, used);
    if (!ex || used.includes(ex.id)) continue;
    used.push(ex.id);
    exercises.push(plannedFrom(ex, style));
  }
  return { id: uid(), name: t.name, focus: t.focus, isRest: false, exercises };
}

export function recommendedSplit(intake: Pick<Intake, "equipment" | "trainingStyle">, days: number): Split {
  const layout = LAYOUTS[Math.min(7, Math.max(1, days))] ?? LAYOUTS[3];
  const name =
    days <= 3 ? `${days}-day full body` : days === 4 ? "Upper / lower" : days === 5 ? "Upper / lower + PPL" : days === 6 ? "Push / pull / legs" : "Daily rotation";
  return {
    id: uid(),
    name,
    source: "recommended",
    days: layout.map((k) => (k ? buildDay(k, intake.equipment, intake.trainingStyle) : restDay())),
  };
}

export const BASIC_TEMPLATES = [
  { id: "full_body", label: "Full body", description: "3 days · balanced" },
  { id: "upper_lower", label: "Upper / lower", description: "4 days · simple" },
  { id: "push_pull_legs", label: "Push / pull / legs", description: "6 days · frequent" },
] as const;

export function templateSplit(intake: Pick<Intake, "equipment" | "trainingStyle">, template: (typeof BASIC_TEMPLATES)[number]["id"]): Split {
  const layout = template === "full_body" ? LAYOUTS[3] : template === "upper_lower" ? LAYOUTS[4] : LAYOUTS[6];
  const name = template === "full_body" ? "Full body" : template === "upper_lower" ? "Upper / lower" : "Push / pull / legs";
  return {
    id: uid(),
    name,
    source: "custom",
    days: layout.map((k) => (k ? buildDay(k, intake.equipment, intake.trainingStyle) : restDay())),
  };
}

export function dayForDate(split: Split | null, date: string) {
  if (!split) return null;
  if (split.rotation?.days.length) {
    const start = new Date(`${split.rotation.startDate}T00:00:00Z`).getTime();
    const current = new Date(`${date}T00:00:00Z`).getTime();
    const days = Math.floor((current - start) / 86_400_000);
    return split.rotation.days[((days % split.rotation.days.length) + split.rotation.days.length) % split.rotation.days.length] ?? null;
  }
  return split.days[weekdayIndex(date)] ?? null;
}

/* ---------------- Strength math ---------------- */

/** Epley estimated one-rep max. */
export function e1rm(weightKg: number, reps: number) {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface ExerciseHistoryPoint {
  date: string;
  bestE1rm: number;
  topSet: { weightKg: number; reps: number };
  volumeKg: number;
}

export function exerciseHistory(logs: WorkoutLog[], exerciseId: string): ExerciseHistoryPoint[] {
  const points: ExerciseHistoryPoint[] = [];
  for (const log of [...logs].sort((a, b) => a.date.localeCompare(b.date))) {
    const sets = log.sets.filter((s) => s.exerciseId === exerciseId && s.done && s.reps > 0);
    if (!sets.length) continue;
    let best = sets[0];
    for (const s of sets) if (e1rm(s.weightKg, s.reps) > e1rm(best.weightKg, best.reps)) best = s;
    points.push({
      date: log.date,
      bestE1rm: e1rm(best.weightKg, best.reps),
      topSet: { weightKg: best.weightKg, reps: best.reps },
      volumeKg: sets.reduce((s, x) => s + x.weightKg * x.reps, 0),
    });
  }
  return points;
}

export function trainedExercises(logs: WorkoutLog[]) {
  const map = new Map<string, { id: string; name: string; sessions: number; last: string }>();
  for (const log of logs)
    for (const s of log.sets) {
      if (!s.done) continue;
      const cur = map.get(s.exerciseId);
      if (!cur) map.set(s.exerciseId, { id: s.exerciseId, name: s.exerciseName, sessions: 1, last: log.date });
      else if (cur.last !== log.date) {
        cur.sessions += 1;
        if (log.date > cur.last) cur.last = log.date;
      }
    }
  return Array.from(map.values()).sort((a, b) => b.last.localeCompare(a.last));
}

/** Suggest the next working weight from the most recent session (double progression). */
export function suggestLoad(logs: WorkoutLog[], planned: PlannedExercise): { weightKg: number | null; hint: string } {
  const hist = exerciseHistory(logs, planned.exerciseId);
  const last = hist[hist.length - 1];
  if (!last) return { weightKg: planned.weightKg, hint: planned.weightKg ? "Planned load" : "Pick a weight you could lift ~2 more reps with" };
  const { weightKg, reps } = last.topSet;
  if (reps >= planned.repsMax) return { weightKg: weightKg * 1.025 + 1, hint: `Hit ${reps} reps last time — add a little weight` };
  return { weightKg, hint: `Last: ${reps} reps — aim for ${Math.min(reps + 1, planned.repsMax)}` };
}

export function emptySets(day: WorkoutDay, logs: WorkoutLog[]): SetLog[] {
  return day.exercises.flatMap((ex) => {
    const s = suggestLoad(logs, ex);
    return Array.from({ length: ex.sets }, (_, i) => ({
      id: uid(),
      exerciseId: ex.exerciseId,
      exerciseName: ex.name,
      setIndex: i,
      weightKg: s.weightKg ? Math.round(s.weightKg * 10) / 10 : 0,
      reps: ex.repsMax,
      rpe: null,
      done: false,
    }));
  });
}
