import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_MODEL, SAFETY_PRINCIPLES, clientKey, getOpenAI, rateLimited } from "@/lib/ai/server";
import { getRequestUser } from "@/lib/supabase/server";
import { EXERCISES, recommendedSplit } from "@/lib/workouts";
import type { EquipmentAccess, Split, TrainingStyle } from "@/lib/types";

const Body = z.object({
  request: z.string().min(2).max(800),
  profile: z.object({
    goal: z.string(),
    experience: z.string(),
    equipment: z.enum(["full_gym", "home_gym", "home_dumbbells", "bodyweight"]),
    trainingStyle: z.enum(["strength", "hypertrophy", "general", "athletic"]),
    liftingDays: z.number().min(0).max(7),
    sessionMinutes: z.number().min(15).max(180),
  }),
  currentSplit: z.string().max(4000).optional(),
});

const DaySchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "focus", "isRest", "exercises"],
  properties: {
    name: { type: "string" },
    focus: { type: "string" },
    isRest: { type: "boolean" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "sets", "repsMin", "repsMax", "rpe", "restSec", "notes"],
        properties: {
          name: { type: "string" },
          sets: { type: "integer" },
          repsMin: { type: "integer" },
          repsMax: { type: "integer" },
          rpe: { type: "number" },
          restSec: { type: "integer" },
          notes: { type: "string" },
        },
      },
    },
  },
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "name", "days"],
  properties: {
    reply: { type: "string" },
    name: { type: "string" },
    days: { type: "array", items: DaySchema, minItems: 7, maxItems: 7 },
  },
};

const AiSplit = z.object({
  reply: z.string(),
  name: z.string(),
  days: z
    .array(
      z.object({
        name: z.string(),
        focus: z.string(),
        isRest: z.boolean(),
        exercises: z.array(
          z.object({
            name: z.string(),
            sets: z.number().int().min(1).max(10),
            repsMin: z.number().int().min(1).max(50),
            repsMax: z.number().int().min(1).max(60),
            rpe: z.number().min(5).max(10),
            restSec: z.number().int().min(15).max(600),
            notes: z.string(),
          })
        ),
      })
    )
    .length(7),
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function matchExercise(name: string) {
  const n = name.toLowerCase();
  return EXERCISES.find((e) => e.name.toLowerCase() === n) ?? EXERCISES.find((e) => n.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(n));
}

/** Rule-based fallback: reads day count, equipment, and style hints from the request. */
function offlineSplit(request: string, p: z.infer<typeof Body>["profile"]): { reply: string; split: Split } {
  const t = request.toLowerCase();
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  const m = t.match(/(\d|two|three|four|five|six)[\s-]*(?:day|days|x)/);
  const days = m ? (Number(m[1]) || words[m[1]]) : p.liftingDays || 3;
  let equipment: EquipmentAccess = p.equipment;
  if (/no (gym|equipment)|bodyweight|travel|hotel/.test(t)) equipment = "bodyweight";
  else if (/dumbbell|home/.test(t)) equipment = "home_dumbbells";
  else if (/full gym|commercial gym|machines/.test(t)) equipment = "full_gym";
  let style: TrainingStyle = p.trainingStyle;
  if (/strength|stronger|powerlift/.test(t)) style = "strength";
  else if (/muscle|hypertrophy|size|bodybuild/.test(t)) style = "hypertrophy";
  else if (/athletic|sport|power/.test(t)) style = "athletic";
  const split = recommendedSplit({ equipment, trainingStyle: style }, Math.min(6, Math.max(1, days)));
  return {
    reply: `Here's a ${split.name.toLowerCase()} plan with ${Math.min(6, Math.max(1, days))} training days built for your equipment. Review it and save if it looks right.`,
    split: { ...split, source: "ai" },
  };
}

export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (auth.configured && !auth.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (rateLimited(`coach:${clientKey(req, auth.user?.id)}`, 10)) return NextResponse.json({ error: "Give it a minute and try again." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { request, profile, currentSplit } = parsed.data;

  const openai = getOpenAI();
  if (!openai) return NextResponse.json({ ...offlineSplit(request, profile), engine: "offline" });

  try {
    const library = EXERCISES.map((e) => e.name).join(", ");
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      temperature: 0.3,
      response_format: { type: "json_schema", json_schema: { name: "weekly_split", strict: true, schema: SCHEMA } },
      messages: [
        {
          role: "system",
          content: `${SAFETY_PRINCIPLES}

You design or revise a weekly resistance-training split. Return exactly 7 days, Monday first. Rest days have isRest true and no exercises.
Keep sessions within the user's time budget (assume ~2 minutes per set including rest). Prefer exercises from this library when they fit: ${library}.
Only use equipment the user has. Use sensible volumes (10–20 hard sets per muscle per week for most people), RPE 6–9, and at least one full rest day unless the user insists.
"reply" is 1–2 sentences explaining the main choices in plain language.`,
        },
        {
          role: "user",
          content: `Profile: goal ${profile.goal}, experience ${profile.experience}, equipment ${profile.equipment}, style ${profile.trainingStyle}, currently ${profile.liftingDays} days/week, ~${profile.sessionMinutes} min sessions.
${currentSplit ? `Current split:\n${currentSplit}\n` : ""}Request: ${request}`,
        },
      ],
    });
    const result = AiSplit.parse(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
    const split: Split = {
      id: crypto.randomUUID(),
      name: result.name,
      source: "ai",
      days: result.days.map((d) => ({
        id: crypto.randomUUID(),
        name: d.isRest ? "Rest" : d.name,
        focus: d.focus,
        isRest: d.isRest,
        exercises: d.isRest
          ? []
          : d.exercises.map((e) => {
              const lib = matchExercise(e.name);
              return {
                id: crypto.randomUUID(),
                exerciseId: lib?.id ?? `custom:${slug(e.name)}`,
                name: lib?.name ?? e.name,
                sets: e.sets,
                repsMin: Math.min(e.repsMin, e.repsMax),
                repsMax: Math.max(e.repsMin, e.repsMax),
                rpe: e.rpe,
                restSec: e.restSec,
                weightKg: null,
                notes: e.notes,
              };
            }),
      })),
    };
    return NextResponse.json({ reply: result.reply, split, engine: "openai" });
  } catch (e) {
    console.error("coach ai error", e);
    return NextResponse.json({ ...offlineSplit(request, profile), engine: "offline" });
  }
}
