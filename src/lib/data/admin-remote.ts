"use client";

import { apiPost } from "../api";
import type { DataAdapter } from "./adapter";
import type { CardioEntry, DailyLog, FoodEntry, Profile, Snapshot, WorkoutLog } from "../types";

/** Loads and writes another account through the admin server, which checks the allowlist on every call. */
export function createAdminActAdapter(userId: string): DataAdapter {
  const call = <T>(op: string, payload?: unknown) => apiPost<T>("/api/admin/act", { userId, op, payload });
  return {
    load: () => call<Snapshot>("load"),
    saveProfile: (profile: Profile) => call("saveProfile", profile).then(() => undefined),
    upsertFood: (entry: FoodEntry) => call("upsertFood", entry).then(() => undefined),
    deleteFood: (id: string) => call("deleteFood", { id }).then(() => undefined),
    upsertCardio: (entry: CardioEntry) => call("upsertCardio", entry).then(() => undefined),
    deleteCardio: (id: string) => call("deleteCardio", { id }).then(() => undefined),
    upsertDaily: (log: DailyLog) => call("upsertDaily", log).then(() => undefined),
    upsertWorkout: (log: WorkoutLog) => call("upsertWorkout", log).then(() => undefined),
    deleteWorkout: (id: string) => call("deleteWorkout", { id }).then(() => undefined),
    clearAll: () => call("clearAll").then(() => undefined),
  };
}
