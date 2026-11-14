import type { Settings } from "./types";

/** Bump this when terms or the privacy policy change in a way that needs a new acceptance. */
export const LEGAL_VERSION = "2026-11-13";

export const LEGAL_ACCEPT_KEY = "simplyfit:legal-accepted";

export const MIN_AGE = 16;
export const MAX_AGE = 90;

export const LEGAL_UPDATED = "November 13, 2026";

export function hasAcceptedLegal(legal: Settings["legal"] | undefined) {
  return Boolean(legal?.acceptedAt && legal.version === LEGAL_VERSION);
}

export function isEligibleAge(age: unknown) {
  const n = typeof age === "number" ? age : typeof age === "string" && age.trim() !== "" ? Number(age) : NaN;
  return Number.isFinite(n) && n >= MIN_AGE && n <= MAX_AGE;
}

export function ageBlockMessage() {
  return `Simply Fit is for ages ${MIN_AGE} to ${MAX_AGE}. We didn't save health or body data for this age.`;
}

export const AI_ON_COPY =
  "Meal text, photos, and voice notes are sent to OpenAI, along with diet preferences and allergies. Turn this off to keep estimates on the built-in food list.";

export const AI_OFF_COPY = "Cloud AI is off. Meal estimates use the built-in food list. Photos and voice are not sent to OpenAI.";
