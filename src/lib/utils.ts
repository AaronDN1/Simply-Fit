import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const round = (n: number, step = 1) => Math.round(n / step) * step;

export function formatNumber(n: number, digits = 0) {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/* ---------- Dates (local calendar days as YYYY-MM-DD) ---------- */

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(s: string) {
  return (parseISODate(s).getDay() + 6) % 7;
}

export function lastNDays(n: number, end = todayISO()) {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

export function formatDay(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" }) {
  return parseISODate(s).toLocaleDateString("en-US", opts);
}

export function relativeDayLabel(s: string) {
  const t = todayISO();
  if (s === t) return "Today";
  if (s === addDays(t, -1)) return "Yesterday";
  if (s === addDays(t, 1)) return "Tomorrow";
  return formatDay(s, { weekday: "short", month: "short", day: "numeric" });
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
