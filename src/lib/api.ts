"use client";

import { accessToken } from "./auth";

export async function apiPost<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
  const token = await accessToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error("That took too long. Please try again.");
    }
    throw e;
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Something went wrong. Please try again.");
  return json as T;
}
