"use client";

/**
 * Health-data integration.
 *
 * Browsers can't read Apple Health or Health Connect directly. Simply Fit's native
 * shells (iOS / Android wrappers around this web app) inject `window.SimplyFitNative`,
 * which reads HealthKit / Health Connect on-device. Background syncs from the native
 * side go to POST /api/health/ingest with the user's Supabase access token.
 * On the plain web, manual logging is used instead.
 *
 * The website never shows this. HEALTH_SYNC_UI stays false until a phone app
 * can actually read HealthKit or Health Connect. The bridge, settings UI, and
 * ingest route stay in the repo for that later build.
 */

/** When false, no screen mentions phone, watch, Apple Health, or Health Connect sync. */
export const HEALTH_SYNC_UI = false;

export type HealthPlatform = "apple_health" | "health_connect";

export interface HealthDay {
  date: string;
  steps?: number;
  sleepHours?: number;
  weightKg?: number;
}

export interface HealthWorkout {
  externalId: string;
  date: string;
  activity: string;
  minutes: number;
  intensity: "easy" | "moderate" | "hard";
}

interface NativeBridge {
  platform: HealthPlatform;
  requestAuthorization(scopes: ("steps" | "sleep" | "weight" | "workouts")[]): Promise<boolean>;
  read(range: { start: string; end: string }): Promise<{ days: HealthDay[]; workouts: HealthWorkout[] }>;
}

declare global {
  interface Window {
    SimplyFitNative?: NativeBridge;
  }
}

export function nativeBridge(): NativeBridge | null {
  if (typeof window === "undefined") return null;
  return window.SimplyFitNative ?? null;
}

export function detectDevice(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export const PLATFORM_LABEL: Record<HealthPlatform, string> = { apple_health: "Apple Health", health_connect: "Health Connect" };
