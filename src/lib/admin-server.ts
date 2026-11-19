import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminEmail, readAccess, type AdminDirectory, type AdminUserDetail, type AdminUserSummary } from "./admin";
import { getRequestUser, getSupabaseAdmin } from "./supabase/server";
import { addDays, todayISO } from "./utils";
import { defaultSettings, type AccountAccess, type CardioEntry, type DailyLog, type FoodEntry, type Profile, type Settings, type Snapshot, type WorkoutLog } from "./types";

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type Row = Record<string, unknown>;

export async function requireAdmin(req: Request): Promise<{ admin: AdminClient; user: User } | { error: NextResponse }> {
  const auth = await getRequestUser(req);
  if (!auth.configured) return { error: NextResponse.json({ error: "Hosted admin needs Supabase." }, { status: 400 }) };
  if (!auth.user?.email || !isAdminEmail(auth.user.email)) return { error: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  const admin = getSupabaseAdmin();
  if (!admin) return { error: NextResponse.json({ error: "The server admin key isn't configured." }, { status: 501 }) };
  return { admin, user: auth.user };
}

function asRecord(value: unknown): Row {
  return value && typeof value === "object" ? (value as Row) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : null;
}

function summary(row: Row): AdminUserSummary {
  const intake = asRecord(row.intake);
  const plan = asRecord(row.plan);
  const settings = asRecord(row.settings) as Partial<Settings>;
  const access = readAccess(settings as Settings);
  return {
    id: String(row.id),
    email: text(row.email) ?? "",
    name: text(row.display_name) ?? "",
    createdAt: text(row.created_at),
    onboardedAt: text(row.onboarded_at),
    disabledAt: access.disabledAt,
    planAccess: access.plan,
    goal: text(intake.goal),
    calorieTarget: typeof plan.calorieTarget === "number" ? plan.calorieTarget : null,
  };
}

function detail(row: Row): AdminUserDetail {
  const base = summary(row);
  const intake = asRecord(row.intake);
  const plan = asRecord(row.plan);
  const levers = asRecord(plan.levers);
  const settings = { ...defaultSettings, ...(asRecord(row.settings) as Partial<Settings>) };
  return {
    ...base,
    age: typeof intake.age === "number" ? intake.age : null,
    units: settings.units.weight,
    proteinG: typeof plan.proteinG === "number" ? plan.proteinG : null,
    liftingDays: typeof levers.liftingDays === "number" ? levers.liftingDays : typeof intake.liftingDaysPerWeek === "number" ? intake.liftingDaysPerWeek : null,
  };
}

function safeQuery(raw: string) {
  return raw.replace(/[%_,.()"'\\]/g, " ").trim().slice(0, 80);
}

async function countOf(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const res = await query;
  if (res.error) return null;
  return res.count ?? 0;
}

export async function listHostedUsers(admin: SupabaseClient, query: string, offset: number): Promise<AdminDirectory> {
  const limit = 40;
  const q = safeQuery(query);
  let list = admin.from("profiles").select("id, email, display_name, intake, plan, settings, onboarded_at, created_at");
  if (q) list = list.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
  const [total, onboarded, disabled, planGranted, page] = await Promise.all([
    countOf(admin.from("profiles").select("id", { count: "exact", head: true })),
    countOf(admin.from("profiles").select("id", { count: "exact", head: true }).not("onboarded_at", "is", null)),
    countOf(admin.from("profiles").select("id", { count: "exact", head: true }).not("settings->access->>disabledAt", "is", null)),
    countOf(admin.from("profiles").select("id", { count: "exact", head: true }).eq("settings->access->>plan", "granted")),
    list.order("created_at", { ascending: false }).range(offset, offset + limit - 1),
  ]);
  if (page.error) throw new Error(page.error.message);
  const users = ((page.data ?? []) as Row[]).map(summary);
  return {
    users,
    total: total ?? users.length,
    onboarded: onboarded ?? users.filter((user) => user.onboardedAt).length,
    disabled: disabled ?? users.filter((user) => user.disabledAt).length,
    planGranted: planGranted ?? users.filter((user) => user.planAccess === "granted").length,
    hasMore: (page.data?.length ?? 0) === limit,
  };
}

export async function hostedUserDetail(admin: SupabaseClient, id: string) {
  const { data, error } = await admin.from("profiles").select("id, email, display_name, intake, plan, settings, onboarded_at, created_at").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return detail(data as Row);
}

export async function setHostedAccess(admin: SupabaseClient, actorId: string, id: string, patch: Partial<AccountAccess>) {
  if (actorId === id && patch.disabledAt) throw new Error("You can't disable the account you're signed in with.");
  const { data, error } = await admin.from("profiles").select("email, settings").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No account with that id.");
  const row = data as Row;
  if (patch.disabledAt && isAdminEmail(text(row.email))) throw new Error("Allowlisted administrators stay active.");
  const settings = { ...defaultSettings, ...(asRecord(row.settings) as Partial<Settings>) };
  const access = readAccess(settings);
  settings.access = {
    disabledAt: patch.disabledAt !== undefined ? patch.disabledAt : access.disabledAt,
    plan: patch.plan ?? access.plan,
  };
  const saved = await admin.from("profiles").update({ settings, updated_at: new Date().toISOString() }).eq("id", id);
  if (saved.error) throw new Error(saved.error.message);
  if (patch.disabledAt !== undefined) {
    const banned = await admin.auth.admin.updateUserById(id, { ban_duration: patch.disabledAt ? "876000h" : "none" });
    if (banned.error) throw new Error(banned.error.message);
  }
}

const toFood = (r: Row): FoodEntry => ({
  id: String(r.id),
  date: String(r.date),
  meal: r.meal as FoodEntry["meal"],
  name: String(r.name),
  quantity: String(r.quantity ?? ""),
  calories: Number(r.calories),
  proteinG: Number(r.protein_g),
  carbsG: Number(r.carbs_g),
  fatG: Number(r.fat_g),
  source: r.source as FoodEntry["source"],
  createdAt: String(r.created_at),
});

const toCardio = (r: Row): CardioEntry => ({
  id: String(r.id),
  date: String(r.date),
  activity: String(r.activity),
  minutes: Number(r.minutes),
  intensity: r.intensity as CardioEntry["intensity"],
  source: r.source as CardioEntry["source"],
  createdAt: String(r.created_at),
});

const toDaily = (r: Row): DailyLog => ({
  date: String(r.date),
  steps: r.steps == null ? null : Number(r.steps),
  stepsSource: (r.steps_source as DailyLog["stepsSource"]) ?? null,
  sleepHours: r.sleep_hours == null ? null : Number(r.sleep_hours),
  sleepQuality: (r.sleep_quality as DailyLog["sleepQuality"]) ?? null,
  weightKg: r.weight_kg == null ? null : Number(r.weight_kg),
  readiness: (r.readiness as DailyLog["readiness"]) ?? null,
});

const toWorkout = (r: Row): WorkoutLog => ({
  id: String(r.id),
  date: String(r.date),
  dayId: String(r.day_id),
  dayName: String(r.day_name),
  sets: (r.sets as WorkoutLog["sets"]) ?? [],
  notes: String(r.notes ?? ""),
  startedAt: String(r.started_at),
  completedAt: text(r.completed_at),
});

function check<T extends { error: { message: string } | null }>(res: T) {
  if (res.error) throw new Error(res.error.message);
  return res;
}

export async function actAsUser(admin: SupabaseClient, userId: string, op: string, payload: unknown): Promise<Snapshot | { ok: true }> {
  const exists = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (exists.error) throw new Error(exists.error.message);
  if (!exists.data) throw new Error("No account with that id.");
  const body = asRecord(payload);

  if (op === "load") {
    const since = addDays(todayISO(), -365);
    const [p, f, c, d, w] = await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      admin.from("food_entries").select("*").eq("user_id", userId).gte("date", since).order("created_at"),
      admin.from("cardio_entries").select("*").eq("user_id", userId).gte("date", since).order("created_at"),
      admin.from("daily_logs").select("*").eq("user_id", userId).gte("date", since).order("date"),
      admin.from("workout_logs").select("*").eq("user_id", userId).gte("date", since).order("date"),
    ]);
    [p, f, c, d, w].forEach(check);
    const row = p.data as Row;
    const profile: Profile = {
      id: userId,
      email: text(row.email) ?? "",
      displayName: text(row.display_name) ?? "",
      intake: (row.intake as Profile["intake"]) ?? null,
      plan: (row.plan as Profile["plan"]) ?? null,
      split: (row.split as Profile["split"]) ?? null,
      settings: { ...defaultSettings, ...(asRecord(row.settings) as Partial<Settings>) },
      onboardedAt: text(row.onboarded_at),
      createdAt: text(row.created_at) ?? "",
    };
    return {
      profile,
      foods: ((f.data ?? []) as Row[]).map(toFood),
      cardio: ((c.data ?? []) as Row[]).map(toCardio),
      daily: ((d.data ?? []) as Row[]).map(toDaily),
      workouts: ((w.data ?? []) as Row[]).map(toWorkout),
    };
  }

  if (op === "saveProfile") {
    const profile = payload as Profile;
    check(
      await admin
        .from("profiles")
        .update({
          display_name: profile.displayName,
          intake: profile.intake,
          plan: profile.plan,
          split: profile.split,
          settings: profile.settings,
          onboarded_at: profile.onboardedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
    );
    return { ok: true };
  }

  if (op === "upsertFood") {
    const e = payload as FoodEntry;
    check(
      await admin.from("food_entries").upsert({
        id: e.id,
        user_id: userId,
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
    return { ok: true };
  }
  if (op === "deleteFood") {
    check(await admin.from("food_entries").delete().eq("id", String(body.id)).eq("user_id", userId));
    return { ok: true };
  }
  if (op === "upsertCardio") {
    const e = payload as CardioEntry;
    check(
      await admin.from("cardio_entries").upsert({
        id: e.id,
        user_id: userId,
        date: e.date,
        activity: e.activity,
        minutes: e.minutes,
        intensity: e.intensity,
        source: e.source,
        created_at: e.createdAt,
      })
    );
    return { ok: true };
  }
  if (op === "deleteCardio") {
    check(await admin.from("cardio_entries").delete().eq("id", String(body.id)).eq("user_id", userId));
    return { ok: true };
  }
  if (op === "upsertDaily") {
    const l = payload as DailyLog;
    check(
      await admin.from("daily_logs").upsert({
        user_id: userId,
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
    return { ok: true };
  }
  if (op === "upsertWorkout") {
    const l = payload as WorkoutLog;
    check(
      await admin.from("workout_logs").upsert({
        id: l.id,
        user_id: userId,
        date: l.date,
        day_id: l.dayId,
        day_name: l.dayName,
        sets: l.sets,
        notes: l.notes,
        started_at: l.startedAt,
        completed_at: l.completedAt,
      })
    );
    return { ok: true };
  }
  if (op === "deleteWorkout") {
    check(await admin.from("workout_logs").delete().eq("id", String(body.id)).eq("user_id", userId));
    return { ok: true };
  }
  if (op === "clearAll") {
    await Promise.all(
      ["food_entries", "cardio_entries", "daily_logs", "workout_logs"].map(async (table) => check(await admin.from(table).delete().eq("user_id", userId)))
    );
    return { ok: true };
  }
  throw new Error("Unknown admin action.");
}
