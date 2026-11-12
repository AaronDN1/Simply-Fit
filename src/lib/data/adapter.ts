import type { CardioEntry, DailyLog, FoodEntry, Profile, Snapshot, WorkoutLog } from "../types";

/** Persistence boundary. The store keeps state in memory and writes through one of these. */
export interface DataAdapter {
  load(): Promise<Snapshot>;
  saveProfile(profile: Profile): Promise<void>;
  upsertFood(entry: FoodEntry): Promise<void>;
  deleteFood(id: string): Promise<void>;
  upsertCardio(entry: CardioEntry): Promise<void>;
  deleteCardio(id: string): Promise<void>;
  upsertDaily(log: DailyLog): Promise<void>;
  upsertWorkout(log: WorkoutLog): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  /** Removes all tracked data but keeps the account. */
  clearAll(): Promise<void>;
}
