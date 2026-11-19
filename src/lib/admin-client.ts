"use client";

import { accessToken } from "./auth";
import { localAdminDetail, localAdminDirectory, setLocalAccountAccess } from "./admin-local";
import type { AdminDirectory, AdminUserDetail } from "./admin";
import type { AccountAccess } from "./types";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json as { error?: string } | null)?.error ?? "Something went wrong.");
  return json as T;
}

export async function loadAdminDirectory(mode: "demo" | "supabase", query: string, offset: number): Promise<AdminDirectory> {
  if (mode === "demo") return localAdminDirectory(query);
  const params = new URLSearchParams({ q: query, offset: String(offset) });
  return adminFetch<AdminDirectory>(`/api/admin/users?${params}`);
}

export async function loadAdminDetail(mode: "demo" | "supabase", id: string): Promise<AdminUserDetail | null> {
  if (mode === "demo") return localAdminDetail(id);
  return adminFetch<AdminUserDetail>(`/api/admin/users/${id}`);
}

export async function updateAdminAccess(mode: "demo" | "supabase", id: string, patch: Partial<AccountAccess>) {
  if (mode === "demo") {
    setLocalAccountAccess(id, patch);
    return localAdminDetail(id);
  }
  return adminFetch<AdminUserDetail>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(patch.disabledAt !== undefined ? { disabled: Boolean(patch.disabledAt) } : {}),
      ...(patch.plan ? { plan: patch.plan } : {}),
    }),
  });
}
