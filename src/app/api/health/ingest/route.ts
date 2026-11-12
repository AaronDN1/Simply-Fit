import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getRequestUser } from "@/lib/supabase/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.object({
  platform: z.enum(["apple_health", "health_connect"]),
  days: z
    .array(
      z.object({
        date,
        steps: z.number().int().min(0).max(150000).optional(),
        sleepHours: z.number().min(0).max(24).optional(),
        weightKg: z.number().min(20).max(400).optional(),
      })
    )
    .max(120)
    .default([]),
  workouts: z
    .array(
      z.object({
        externalId: z.string().min(1).max(200),
        date,
        activity: z.string().min(1).max(80),
        minutes: z.number().int().min(1).max(1440),
        intensity: z.enum(["easy", "moderate", "hard"]),
      })
    )
    .max(500)
    .default([]),
});

/** Stable UUID so re-syncing the same workout never creates duplicates. */
function stableId(...parts: string[]) {
  const h = createHash("sha256").update(parts.join(":")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Receives health data from the native companion (HealthKit / Health Connect).
 * Auth: `Authorization: Bearer <supabase access token>`. Writes go through RLS as the user.
 */
export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (!auth.configured) return NextResponse.json({ error: "Health sync requires Supabase to be configured." }, { status: 501 });
  if (!auth.user || !auth.token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const { platform, days, workouts } = parsed.data;
  const uid = auth.user.id;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  const dailyRows = days.map((d) => ({
    user_id: uid,
    date: d.date,
    ...(d.steps != null ? { steps: d.steps, steps_source: platform } : {}),
    ...(d.sleepHours != null ? { sleep_hours: Math.round(d.sleepHours * 100) / 100 } : {}),
    ...(d.weightKg != null ? { weight_kg: Math.round(d.weightKg * 100) / 100 } : {}),
    updated_at: new Date().toISOString(),
  }));
  if (dailyRows.length) {
    const { error } = await supabase.from("daily_logs").upsert(dailyRows, { onConflict: "user_id,date", defaultToNull: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (workouts.length) {
    const rows = workouts.map((w) => ({
      id: stableId(uid, platform, w.externalId),
      user_id: uid,
      date: w.date,
      activity: w.activity,
      minutes: w.minutes,
      intensity: w.intensity,
      source: platform,
    }));
    const { error } = await supabase.from("cardio_entries").upsert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase.from("profiles").select("settings").eq("id", uid).single();
  if (profile) {
    const settings = profile.settings ?? {};
    const health = { ...(settings.health ?? {}), [platform === "apple_health" ? "appleHealth" : "healthConnect"]: "connected", lastSyncAt: new Date().toISOString() };
    await supabase.from("profiles").update({ settings: { ...settings, health } }).eq("id", uid);
  }

  return NextResponse.json({ ok: true, days: dailyRows.length, workouts: workouts.length });
}
