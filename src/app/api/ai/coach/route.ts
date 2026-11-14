import { NextResponse } from "next/server";
import { z } from "zod";
import { SAFETY_PRINCIPLES, cloudError, getOpenAI, modelOptions, prepareAiAttachments, resolveCloudAi } from "@/lib/ai/server";
import { getRequestUser } from "@/lib/supabase/server";
import { EXERCISES, recommendedSplit } from "@/lib/workouts";
import type { EquipmentAccess, Split, TrainingStyle } from "@/lib/types";

const Body = z.object({
  request: z.string().max(800).default(""),
  profile: z.object({
    goal: z.string(),
    experience: z.string(),
    equipment: z.enum(["full_gym", "home_gym", "home_dumbbells", "bodyweight"]),
    trainingStyle: z.enum(["strength", "hypertrophy", "general", "athletic"]),
    liftingDays: z.number().min(0).max(7),
    sessionMinutes: z.number().min(15).max(180),
  }),
  currentSplit: z.string().max(4000).optional(),
  useCloud: z.boolean().optional(),
  attachments: z
    .array(z.object({ type: z.enum(["image", "audio"]), dataUrl: z.string().max(20_000_000), name: z.string().max(120) }))
    .max(3)
    .optional(),
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
  required: ["reply", "name", "rotation", "days"],
  properties: {
    reply: { type: "string" },
    name: { type: "string" },
    rotation: { type: "boolean" },
    days: { type: "array", items: DaySchema, minItems: 1, maxItems: 7 },
  },
};

const AiSplit = z.object({
  reply: z.string(),
  name: z.string(),
  rotation: z.boolean(),
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
    .min(1)
    .max(7),
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function matchExercise(name: string) {
  const n = name.toLowerCase();
  return EXERCISES.find((e) => e.name.toLowerCase() === n) ?? EXERCISES.find((e) => n.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(n));
}

function friendlyDayName(day: { name: string; focus: string; exercises: { name: string }[] }, index: number) {
  if (!/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|day\s*\d+)$/i.test(day.name.trim())) return day.name;
  const text = `${day.focus} ${day.exercises.map((e) => e.name).join(" ")}`.toLowerCase();
  const has = (...words: string[]) => words.some((word) => text.includes(word));
  if (has("biceps", "curl") && has("triceps", "pushdown", "extension")) return "Arms";
  if (has("chest", "bench", "press", "push-up") && has("triceps")) return "Push";
  if (has("back", "row", "pulldown", "pull-up") && has("biceps")) return "Pull";
  if (has("quad", "squat", "leg press") && has("hamstring", "deadlift", "leg curl")) return "Legs";
  if (has("chest", "bench", "press")) return "Chest";
  if (has("back", "row", "pulldown", "pull-up")) return "Back";
  if (has("shoulder", "delt", "overhead")) return "Shoulders";
  return `Workout ${index + 1}`;
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
  const isRotation = /repeat|rotation|rest days? as needed|no schedul|indefinitely/.test(t);
  const rotationDays = split.days.filter((d) => !d.isRest);
  return {
    reply: `Here's a ${split.name.toLowerCase()} plan with ${rotationDays.length} training days built for your equipment. Review it and save if it looks right.`,
    split: {
      ...split,
      source: "ai",
      ...(isRotation ? { days: rotationDays, rotation: { startDate: new Date().toISOString().slice(0, 10), days: rotationDays } } : {}),
    },
  };
}

export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (auth.configured && !auth.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { request, profile, currentSplit, attachments, useCloud } = parsed.data;

  const decision = await resolveCloudAi({
    req,
    userId: auth.user?.id ?? null,
    requested: useCloud !== false,
    bucket: "coach",
    hasAttachments: Boolean(attachments?.length),
  });
  if (decision.mode !== "cloud") {
    if (decision.mode === "error") return cloudError(decision);
    const fallback = offlineSplit(request, profile);
    return NextResponse.json({
      ...fallback,
      reply: [fallback.reply, decision.note].filter(Boolean).join(" "),
      engine: "offline",
    });
  }

  const openai = getOpenAI();
  if (!openai) return NextResponse.json({ error: "AI is unavailable." }, { status: 503 });

  try {
    const prepared = await prepareAiAttachments(openai, attachments, "high");
    const library = EXERCISES.map((e) => e.name).join(", ");
    const requestContent = [
      { type: "text", text: `Profile: goal ${profile.goal}, experience ${profile.experience}, equipment ${profile.equipment}, style ${profile.trainingStyle}, currently ${profile.liftingDays} days/week, ~${profile.sessionMinutes} min sessions.
${currentSplit ? `Current split:\n${currentSplit}\n` : ""}Request: ${request}${prepared.transcripts.length ? `\nVoice note transcript: ${prepared.transcripts.join(" ")}` : ""}` },
      ...prepared.images,
    ];
    const completion = await openai.chat.completions.create({
      ...modelOptions({ maxTokens: 8000, temperature: 0.3 }),
      response_format: { type: "json_schema", json_schema: { name: "weekly_split", strict: true, schema: SCHEMA } },
      messages: [
        {
          role: "system",
          content: `${SAFETY_PRINCIPLES}

You design or revise a resistance-training split. Return 1–7 workout days. Use exactly 7 entries only when the user wants a Monday-to-Sunday calendar with scheduled rest days. If the user describes a repeating rotation or says they take rest days as needed, return only the repeating training days and set "rotation" to true. Do not use weekday names as workout names; use simple focus names such as Chest, Back, Arms, Legs, Push, Pull, or Shoulders.
Treat the request as an ongoing coaching conversation. Make the requested split-level changes while preserving anything the user did not ask to change. If a detail would materially change the plan, ask one concise follow-up question in "reply" while still providing a sensible best-effort draft. Invite the user to dig deeper into a specific day or have you detail the exercises and progression for logging.
Keep sessions within the user's time budget (assume ~2 minutes per set including rest). Prefer exercises from this library when they fit: ${library}.
If the user shares a photo or screenshot of a program, read it carefully and keep its exercises, sets, reps, and day order unless they ask for changes; fill in missing details sensibly.
Only use equipment the user has. Use sensible volumes (10–20 hard sets per muscle per week for most people), RPE 6–9, and at least one full rest day unless the user insists.
"reply" is 1–2 sentences explaining the main choices in plain language.`,
        },
        {
          role: "user",
          content: requestContent,
        },
      ] as never,
    });
    const result = AiSplit.parse(JSON.parse(completion.choices[0]?.message?.content ?? "{}"));
    const split: Split = {
      id: crypto.randomUUID(),
      name: result.name,
      source: "ai",
      days: result.days.map((d) => ({
        id: crypto.randomUUID(),
        name: d.isRest ? "Rest" : friendlyDayName(d, result.days.indexOf(d)),
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
    if (result.rotation) split.rotation = { startDate: new Date().toISOString().slice(0, 10), days: split.days };
    return NextResponse.json({ reply: result.reply, split, engine: "openai" });
  } catch (e) {
    console.error("coach ai error", e);
    return NextResponse.json(
      { error: "The AI service could not complete this plan. Please try again." },
      { status: 502 }
    );
  }
}
