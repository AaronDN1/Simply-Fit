"use client";

import type { DataAdapter } from "./adapter";
import { defaultSettings, type Profile, type Snapshot } from "../types";

const key = (userId: string) => `simplyfit:data:${userId}`;

export function emptySnapshot(id: string, email: string, displayName = ""): Snapshot {
  return {
    profile: {
      id,
      email,
      displayName,
      intake: null,
      plan: null,
      split: null,
      settings: structuredClone(defaultSettings),
      onboardedAt: null,
      createdAt: new Date().toISOString(),
    },
    foods: [],
    cardio: [],
    daily: [],
    workouts: [],
  };
}

export function readLocalSnapshot(userId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

export function writeLocalSnapshot(snap: Snapshot) {
  localStorage.setItem(key(snap.profile.id), JSON.stringify(snap));
}

export function removeLocalSnapshot(userId: string) {
  localStorage.removeItem(key(userId));
}

/** Browser-only persistence used when Supabase isn't configured. */
export function createLocalAdapter(user: { id: string; email: string; name?: string }): DataAdapter {
  let snap: Snapshot = readLocalSnapshot(user.id) ?? emptySnapshot(user.id, user.email, user.name);
  const save = () => writeLocalSnapshot(snap);
  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item;
    else list.push(item);
  };

  return {
    async load() {
      snap = readLocalSnapshot(user.id) ?? snap;
      snap.profile.settings = { ...defaultSettings, ...snap.profile.settings };
      save();
      return structuredClone(snap);
    },
    async saveProfile(profile: Profile) {
      snap.profile = structuredClone(profile);
      save();
    },
    async upsertFood(entry) {
      upsert(snap.foods, entry);
      save();
    },
    async deleteFood(id) {
      snap.foods = snap.foods.filter((f) => f.id !== id);
      save();
    },
    async upsertCardio(entry) {
      upsert(snap.cardio, entry);
      save();
    },
    async deleteCardio(id) {
      snap.cardio = snap.cardio.filter((c) => c.id !== id);
      save();
    },
    async upsertDaily(log) {
      const i = snap.daily.findIndex((d) => d.date === log.date);
      if (i >= 0) snap.daily[i] = log;
      else snap.daily.push(log);
      save();
    },
    async upsertWorkout(log) {
      upsert(snap.workouts, log);
      save();
    },
    async deleteWorkout(id) {
      snap.workouts = snap.workouts.filter((w) => w.id !== id);
      save();
    },
    async clearAll() {
      snap = { ...snap, foods: [], cardio: [], daily: [], workouts: [] };
      save();
    },
  };
}
