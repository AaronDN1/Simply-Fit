import "server-only";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseAdmin, loadOwnAiProfile } from "@/lib/supabase/server";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high";
const REASONING_EFFORT = (process.env.OPENAI_REASONING_EFFORT || "low") as ReasoningEffort;

/** Reasoning models (gpt-5*, o*) reject `temperature`; older chat models reject `reasoning_effort`. */
export function modelOptions({ maxTokens, temperature }: { maxTokens: number; temperature: number }) {
  const isReasoningModel = /^(gpt-[5-9]\d*|o\d)/.test(AI_MODEL);
  return isReasoningModel
    ? { model: AI_MODEL, reasoning_effort: REASONING_EFFORT, max_completion_tokens: maxTokens }
    : { model: AI_MODEL, temperature, max_completion_tokens: maxTokens };
}

export const SAFETY_PRINCIPLES = `You are Simply Fit's assistant. Be practical, concise, supportive, and nonjudgmental.
Never shame users about food choices, missed workouts, weight fluctuations, or imperfect adherence.
Priorities, in order: 1) safety 2) accuracy 3) ask only necessary follow-up questions 4) clear, actionable next steps 5) simplicity.
You give general fitness and nutrition information, not medical advice. If a user mentions symptoms, medical conditions, pregnancy, medications, or signs of disordered eating, gently suggest speaking with a qualified professional and do not give clinical guidance.`;

/** Tiny per-key sliding-window limiter (per server instance). */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > limit;
}

export function clientKey(req: Request, userId?: string | null) {
  return userId ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
}

const DAILY_LIMITS = { nutrition: 120, coach: 30 } as const;

/** Increments the UTC-day counter. Fails closed when the service-role key or migration is missing. */
export async function consumeDailyQuota(userId: string, bucket: keyof typeof DAILY_LIMITS): Promise<"ok" | "limited" | "unconfigured"> {
  const admin = getSupabaseAdmin();
  if (!admin) return "unconfigured";
  const { data, error } = await admin.rpc("consume_ai_quota", {
    p_user: userId,
    p_bucket: bucket,
    p_limit: DAILY_LIMITS[bucket],
  });
  if (error || typeof data !== "boolean") {
    console.error("ai quota error", error);
    return "unconfigured";
  }
  return data ? "ok" : "limited";
}

export type CloudDecision =
  | { mode: "offline"; note?: string }
  | { mode: "cloud"; allergies: string; dietaryPreferences: string[] }
  | { mode: "error"; status: number; error: string };

/**
 * Cloud AI requires a signed-in user, the account setting, and a durable daily cap.
 * Anything else stays on the built-in estimator and does not call OpenAI.
 */
export async function resolveCloudAi(opts: {
  req: Request;
  userId: string | null;
  requested: boolean;
  bucket: keyof typeof DAILY_LIMITS;
  hasAttachments: boolean;
}): Promise<CloudDecision> {
  const offlineNote = opts.hasAttachments ? "Photos and voice need cloud AI. This reply uses the built-in tools and those attachments were not sent." : undefined;
  if (!opts.requested || !getOpenAI()) return { mode: "offline", note: opts.requested ? offlineNote : undefined };
  if (!opts.userId) return { mode: "offline", note: offlineNote };

  const profile = await loadOwnAiProfile(opts.req, opts.userId);
  if (!profile) return { mode: "error", status: 503, error: "AI is unavailable until your profile can be read. Please try again." };
  if (!profile.aiUsesHistory) return { mode: "offline", note: offlineNote };

  const burst = opts.bucket === "nutrition" ? 15 : 6;
  if (rateLimited(`${opts.bucket}:${opts.userId}`, burst, 60_000)) {
    return { mode: "error", status: 429, error: "That's a lot of AI requests at once. Wait a minute and try again." };
  }
  const quota = await consumeDailyQuota(opts.userId, opts.bucket);
  if (quota === "limited") {
    return { mode: "error", status: 429, error: "You've reached today's AI limit. The built-in tools still work, and the limit resets tomorrow." };
  }
  if (quota === "unconfigured") {
    return { mode: "error", status: 503, error: "AI is unavailable until server rate limiting is configured." };
  }
  return { mode: "cloud", allergies: profile.allergies, dietaryPreferences: profile.dietaryPreferences };
}

export function cloudError(decision: Extract<CloudDecision, { mode: "error" }>) {
  return NextResponse.json({ error: decision.error }, { status: decision.status });
}

export type AiAttachment = { type: "image" | "audio"; dataUrl: string; name: string };

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid attachment.");
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

/** Converts browser attachments into OpenAI-compatible text, images, and transcribed audio. */
export async function prepareAiAttachments(
  openai: OpenAI,
  attachments: AiAttachment[] | undefined,
  imageDetail: "low" | "high" | "auto" = "auto"
) {
  const images: { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } }[] = [];
  const transcripts: string[] = [];
  for (const attachment of attachments ?? []) {
    if (attachment.type === "image") {
      images.push({ type: "image_url", image_url: { url: attachment.dataUrl, detail: imageDetail } });
      continue;
    }
    const { mime, buffer } = decodeDataUrl(attachment.dataUrl);
    const file = new File([buffer], attachment.name || "voice-note.webm", { type: mime });
    const transcript = await openai.audio.transcriptions.create({ file, model: "gpt-4o-mini-transcribe" });
    if (transcript.text.trim()) transcripts.push(transcript.text.trim());
  }
  return { images, transcripts };
}
