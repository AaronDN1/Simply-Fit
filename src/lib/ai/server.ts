import "server-only";
import OpenAI from "openai";

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
