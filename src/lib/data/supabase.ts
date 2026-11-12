"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataAdapter } from "./adapter";
import { defaultSettings, type CardioEntry, type DailyLog, type FoodEntry, type Profile, type WorkoutLog } from "../types";
import { addDays, todayISO } from "../utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const HISTORY_DAYS = 365;

const toFood = (r: Row): FoodEntry => ({
  id: r.id,
  date: r.date,
  meal: r.meal,
  name: r.name,
  quantity: r.quantity,
  calories: r.calories,
  proteinG: Number(r.protein_g),
  carbsG: Number(r.carbs_g),
  fatG: Number(r.fat_g),
  source: r.source,
  createdAt: r.created_at,
});

const toCardio = (r: Row): CardioEntry => ({
  id: r.id,
  date: r.date,
  activity: r.activity,
  minutes: r.minutes,
  intensity: r.intensity,
  source: r.source,
  createdAt: r.created_at,
});

const toDaily = (r: Row): DailyLog => ({
  date: r.date,
  steps: r.steps,
  stepsSource: r.steps_source,
  sleepHours: r.sleep_hours == null ? null : Number(r.sleep_hours),
  sleepQuality: r.sleep_quality,
  weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
  readiness: r.readiness,
});

const toWorkout = (r: Row): WorkoutLog => ({
  id: r.id,
  date: r.date,
  dayId: r.day_id,
  dayName: r.day_name,
  sets: r.sets ?? [],
  notes: r.notes ?? "",
  startedAt: r.started_at,
  completedAt: r.completed_at,
});

function check<T extends { error: { message: string } | null }>(res: T) {
  if (res.error) throw new Error(res.error.message);
  return res;
}

export function createSupabaseAdapter(supabase: SupabaseClient, user: { id: string; email: string; name?: string }): DataAdapter {
  const uid = user.id;
  const since = addDays(todayISO(), -HISTORY_DAYS);

  return {
    async load() {
      const [p, f, c, d, w] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("food_entries").select("*").eq("user_id", uid).gte("date", since).order("created_at"),
        supabase.from("cardio_entries").select("*").eq("user_id", uid).gte("date", since).order("created_at"),
        supabase.from("daily_logs").select("*").eq("user_id", uid).gte("date", since).order("date"),
        supabase.from("workout_logs").select("*").eq("user_id", uid).gte("date", since).order("date"),
      ]);
      [p, f, c, d, w].forEach(check);

      let row = p.data as Row | null;
      if (!row) {
        const ins = await supabase
          .from("profiles")
          .upsert({ id: uid, email: user.email, display_name: user.name ?? "", settings: defaultSettings })
          .select("*")
          .single();
        check(ins);
        row = ins.data as Row;
      }
      const profile: Profile = {
        id: uid,
        email: row.email ?? user.email,
        displayName: row.display_name ?? "",
        intake: row.intake,
        plan: row.plan,
        split: row.split,
        settings: { ...defaultSettings, ...(row.settings ?? {}) },
        onboardedAt: row.onboarded_at,
        createdAt: row.created_at,
      };
      return {
        profile,
        foods: (f.data ?? []).map(toFood),
        cardio: (c.data ?? []).map(toCardio),
        daily: (d.data ?? []).map(toDaily),
        workouts: (w.data ?? []).map(toWorkout),
      };
    },
    async saveProfile(pr) {
      check(
        await supabase
          .from("profiles")
          .update({
            display_name: pr.displayName,
            intake: pr.intake,
            plan: pr.plan,
            split: pr.split,
            settings: pr.settings,
            onboarded_at: pr.onboardedAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", uid)
      );
    },
    async upsertFood(e) {
      check(
        await supabase.from("food_entries").upsert({
          id: e.id,
          user_id: uid,
          date: e.date,
          meal: e.meal,
          name: e.name,
          quantity: e.quantity,
          calories: Math.round(e.calories),
          protein_g: e.proteinG,
          carbs_g: e.carbsG,
          fat_g: e.fatG,
          source: e.source,
          created_at: e.createdAt,
        })
      );
    },
    async deleteFood(id) {
      check(await supabase.from("food_entries").delete().eq("id", id).eq("user_id", uid));
    },
    async upsertCardio(e) {
      check(
        await supabase.from("cardio_entries").upsert({
          id: e.id,
          user_id: uid,
          date: e.date,
          activity: e.activity,
          minutes: e.minutes,
          intensity: e.intensity,
          source: e.source,
          created_at: e.createdAt,
        })
      );
    },
    async deleteCardio(id) {
      check(await supabase.from("cardio_entries").delete().eq("id", id).eq("user_id", uid));
    },
    async upsertDaily(l) {
      check(
        await supabase.from("daily_logs").upsert({
          user_id: uid,
          date: l.date,
          steps: l.steps,
          steps_source: l.stepsSource,
          sleep_hours: l.sleepHours,
          sleep_quality: l.sleepQuality,
          weight_kg: l.weightKg,
          readiness: l.readiness,
          updated_at: new Date().toISOString(),
        })
      );
    },
    async upsertWorkout(l) {
      check(
        await supabase.from("workout_logs").upsert({
          id: l.id,
          user_id: uid,
          date: l.date,
          day_id: l.dayId,
          day_name: l.dayName,
          sets: l.sets,
          notes: l.notes,
          started_at: l.startedAt,
          completed_at: l.completedAt,
        })
      );
    },
    async deleteWorkout(id) {
      check(await supabase.from("workout_logs").delete().eq("id", id).eq("user_id", uid));
    },
    async clearAll() {
      await Promise.all(
        ["food_entries", "cardio_entries", "daily_logs", "workout_logs"].map(async (t) =>
          check(await supabase.from(t).delete().eq("user_id", uid))
        )
      );
    },
  };
}
