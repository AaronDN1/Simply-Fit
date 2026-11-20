"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { defaultSettings, type CardioEntry, type DailyLog, type FoodEntry, type Profile, type Snapshot, type WorkoutLog } from "./types";
import { ageBlockMessage, isEligibleAge } from "./legal";
import type { DataAdapter } from "./data/adapter";
import { createLocalAdapter, writeLocalSnapshot } from "./data/local";
import { createSupabaseAdapter } from "./data/supabase";
import { getSupabaseBrowser } from "./supabase/client";
import { authMode, getCurrentUser, getSessionUser, type AuthUser } from "./auth";
import { buildDemoSnapshot } from "./data/seed";
import { isAdminEmail } from "./admin";
import { writeImpersonation, type ImpersonationTarget } from "./impersonation";
import { createAdminActAdapter } from "./data/admin-remote";

type Status = "loading" | "signed_out" | "ready" | "error";

interface StoreValue {
  status: Status;
  error: string | null;
  mode: typeof authMode;
  /** Account the app is currently showing. */
  user: AuthUser | null;
  /** Account that signed in. Unchanged while an admin is impersonating. */
  actor: AuthUser | null;
  impersonating: boolean;
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
  beginImpersonation: (target: ImpersonationTarget) => Promise<void>;
  endImpersonation: () => Promise<void>;
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
    settings: structuredClone(defaultSettings),
    onboardedAt: null,
    createdAt: "",
  },
  foods: [],
  cardio: [],
  daily: [],
  workouts: [],
};

function assertHealthAge(profile: Profile) {
  if (!isEligibleAge(profile.intake?.age)) throw new Error(ageBlockMessage());
}

export function emptyDaily(date: string): DailyLog {
  return { date, steps: null, stepsSource: null, sleepHours: null, sleepQuality: null, weightKg: null, readiness: null };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [actor, setActor] = useState<AuthUser | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [data, setData] = useState<Snapshot>(EMPTY);
  const adapter = useRef<DataAdapter | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async () => {
    try {
      const session = await getSessionUser();
      setActor(session);
      if (!session) {
        writeImpersonation(null);
        setUser(null);
        setImpersonating(false);
        adapter.current = null;
        setStatus("signed_out");
        return;
      }
      const viewing = await getCurrentUser();
      const asSomeoneElse = Boolean(viewing && viewing.id !== session.id && isAdminEmail(session.email));
      setUser(viewing);
      setImpersonating(asSomeoneElse);
      const sb = getSupabaseBrowser();
      adapter.current = asSomeoneElse && viewing && sb ? createAdminActAdapter(viewing.id) : sb ? createSupabaseAdapter(sb, viewing ?? session) : createLocalAdapter(viewing ?? session);
      setData(await adapter.current.load());
      setStatus("ready");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong loading your data.";
      setError(message.includes("<html") || message.includes("<!DOCTYPE") ? "Couldn't reach your account. Check the connection and try again." : message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const run = () => {
      if (alive) void load();
    };
    run();
    const sb = getSupabaseBrowser();
    if (!sb) return () => {
      alive = false;
    };
    // Defer past the auth lock. Calling load() inside this callback deadlocks getSession/getUser and the screen stays on the logo.
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") setTimeout(run, 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
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
      actor,
      impersonating,
      data,
      updateProfile: async (patch) => {
        const p = { ...dataRef.current.profile, ...(typeof patch === "function" ? patch(dataRef.current.profile) : patch) };
        if (p.intake && !isEligibleAge(p.intake.age)) throw new Error(ageBlockMessage());
        await mutate((s) => ({ ...s, profile: p }), (a) => a.saveProfile(p));
      },
      saveFood: (e) => {
        assertHealthAge(dataRef.current.profile);
        return mutate((s) => ({ ...s, foods: upsert(s.foods, e) }), (a) => a.upsertFood(e));
      },
      deleteFood: (id) => mutate((s) => ({ ...s, foods: s.foods.filter((f) => f.id !== id) }), (a) => a.deleteFood(id)),
      saveCardio: (e) => {
        assertHealthAge(dataRef.current.profile);
        return mutate((s) => ({ ...s, cardio: upsert(s.cardio, e) }), (a) => a.upsertCardio(e));
      },
      deleteCardio: (id) => mutate((s) => ({ ...s, cardio: s.cardio.filter((c) => c.id !== id) }), (a) => a.deleteCardio(id)),
      saveDaily: async (date, patch) => {
        assertHealthAge(dataRef.current.profile);
        const cur = dataRef.current.daily.find((d) => d.date === date) ?? emptyDaily(date);
        const log = { ...cur, ...patch, date };
        await mutate(
          (s) => ({ ...s, daily: s.daily.some((d) => d.date === date) ? s.daily.map((d) => (d.date === date ? log : d)) : [...s.daily, log] }),
          (a) => a.upsertDaily(log)
        );
      },
      saveWorkout: (log) => {
        assertHealthAge(dataRef.current.profile);
        return mutate((s) => ({ ...s, workouts: upsert(s.workouts, log) }), (a) => a.upsertWorkout(log));
      },
      deleteWorkout: (id) => mutate((s) => ({ ...s, workouts: s.workouts.filter((w) => w.id !== id) }), (a) => a.deleteWorkout(id)),
      clearData: () => mutate((s) => ({ ...s, foods: [], cardio: [], daily: [], workouts: [] }), (a) => a.clearAll()),
      loadDemoData: async () => {
        if (!user || authMode !== "demo") return;
        const snap = buildDemoSnapshot(user.id, user.email, user.name || "Alex");
        writeLocalSnapshot(snap);
        await load();
      },
      reload: load,
      beginImpersonation: async (target) => {
        const session = await getSessionUser();
        if (!session || !isAdminEmail(session.email)) throw new Error("Not allowed.");
        if (session.id === target.id) throw new Error("You're already signed in as this account.");
        writeImpersonation(target);
        try {
          await load();
        } catch (e) {
          writeImpersonation(null);
          await load();
          throw e instanceof Error ? e : new Error("Couldn't open that account.");
        }
      },
      endImpersonation: async () => {
        writeImpersonation(null);
        await load();
      },
    };
  }, [status, error, user, actor, impersonating, data, mutate, load]);

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
