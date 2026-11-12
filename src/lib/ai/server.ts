import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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
