"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CardioEntry, DailyLog, FoodEntry, Profile, Snapshot, WorkoutLog } from "./types";
import type { DataAdapter } from "./data/adapter";
import { createLocalAdapter, writeLocalSnapshot } from "./data/local";
import { createSupabaseAdapter } from "./data/supabase";
import { getSupabaseBrowser } from "./supabase/client";
import { authMode, getCurrentUser, type AuthUser } from "./auth";
import { buildDemoSnapshot } from "./data/seed";

type Status = "loading" | "signed_out" | "ready" | "error";

interface StoreValue {
  status: Status;
  error: string | null;
  mode: typeof authMode;
  user: AuthUser | null;
  data: Snapshot;
  updateProfile: (patch: Partial<Profile> | ((p: Profile) => Partial<Profile>)) => Promise<void>;
  saveFood: (e: FoodEntry) => Promise<void>;
  deleteFood: (id: string) => Promise<void>;
  saveCardio: (e: CardioEntry) => Promise<void>;
  deleteCardio: (id: string) => Promise<void>;
  saveDaily: (date: string, patch: Partial<Omit<DailyLog, "date">>) => Promise<void>;
  saveWorkout: (log: WorkoutLog) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  clearData: () => Promise<void>;
  loadDemoData: () => Promise<void>;
  reload: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

const EMPTY: Snapshot = {
  profile: {
    id: "",
    email: "",
    displayName: "",
    intake: null,
    plan: null,
    split: null,
    settings: {
      units: { weight: "lb", height: "imperial" },
      notifications: { dailyPlan: true, mealReminders: false, workoutReminders: true, weeklyReview: true },
      privacy: { aiUsesHistory: true, productAnalytics: false },
      health: { appleHealth: "not_connected", healthConnect: "not_connected", lastSyncAt: null },
    },
    onboardedAt: null,
    createdAt: "",
  },
  foods: [],
  cardio: [],
  daily: [],
  workouts: [],
};

export function emptyDaily(date: string): DailyLog {
  return { date, steps: null, stepsSource: null, sleepHours: null, sleepQuality: null, weightKg: null, readiness: null };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<Snapshot>(EMPTY);
  const adapter = useRef<DataAdapter | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async () => {
    try {
      const u = await getCurrentUser();
      setUser(u);
      if (!u) {
        adapter.current = null;
        setStatus("signed_out");
        return;
      }
      const sb = getSupabaseBrowser();
      adapter.current = sb ? createSupabaseAdapter(sb, u) : createLocalAdapter(u);
      setData(await adapter.current.load());
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong loading your data.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  /** Optimistic update + write-through. Rolls back if persistence fails. */
  const mutate = useCallback(async (next: (s: Snapshot) => Snapshot, persist: (a: DataAdapter) => Promise<void>) => {
    const prev = dataRef.current;
    const updated = next(prev);
    dataRef.current = updated;
    setData(updated);
    if (!adapter.current) return;
    try {
      await persist(adapter.current);
    } catch (e) {
      dataRef.current = prev;
      setData(prev);
      throw e instanceof Error ? e : new Error("Couldn't save that change.");
    }
  }, []);

  const value = useMemo<StoreValue>(() => {
    const upsert = <T extends { id: string }>(list: T[], item: T) => {
      const i = list.findIndex((x) => x.id === item.id);
      return i >= 0 ? list.map((x, j) => (j === i ? item : x)) : [...list, item];
    };
    return {
      status,
      error,
      mode: authMode,
      user,
      data,
      updateProfile: async (patch) => {
        const p = { ...dataRef.current.profile, ...(typeof patch === "function" ? patch(dataRef.current.profile) : patch) };
        await mutate((s) => ({ ...s, profile: p }), (a) => a.saveProfile(p));
      },
      saveFood: (e) => mutate((s) => ({ ...s, foods: upsert(s.foods, e) }), (a) => a.upsertFood(e)),
      deleteFood: (id) => mutate((s) => ({ ...s, foods: s.foods.filter((f) => f.id !== id) }), (a) => a.deleteFood(id)),
      saveCardio: (e) => mutate((s) => ({ ...s, cardio: upsert(s.cardio, e) }), (a) => a.upsertCardio(e)),
      deleteCardio: (id) => mutate((s) => ({ ...s, cardio: s.cardio.filter((c) => c.id !== id) }), (a) => a.deleteCardio(id)),
      saveDaily: async (date, patch) => {
        const cur = dataRef.current.daily.find((d) => d.date === date) ?? emptyDaily(date);
        const log = { ...cur, ...patch, date };
        await mutate(
          (s) => ({ ...s, daily: s.daily.some((d) => d.date === date) ? s.daily.map((d) => (d.date === date ? log : d)) : [...s.daily, log] }),
          (a) => a.upsertDaily(log)
        );
      },
      saveWorkout: (log) => mutate((s) => ({ ...s, workouts: upsert(s.workouts, log) }), (a) => a.upsertWorkout(log)),
      deleteWorkout: (id) => mutate((s) => ({ ...s, workouts: s.workouts.filter((w) => w.id !== id) }), (a) => a.deleteWorkout(id)),
      clearData: () => mutate((s) => ({ ...s, foods: [], cardio: [], daily: [], workouts: [] }), (a) => a.clearAll()),
      loadDemoData: async () => {
        if (!user || authMode !== "demo") return;
        const snap = buildDemoSnapshot(user.id, user.email, user.name || "Alex");
        writeLocalSnapshot(snap);
        await load();
      },
      reload: load,
    };
  }, [status, error, user, data, mutate, load]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export function useUnits() {
  return useStore().data.profile.settings.units;
}
