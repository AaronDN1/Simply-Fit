import type { AccountAccess, Settings } from "./types";

/**
 * The only way into Admin. Add an email here and ship that change.
 * There is no request flow in the product. Matching ignores case and surrounding spaces.
 */
export const ADMIN_EMAILS = ["adnathans@gmail.com"];

export function isAdminEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return ADMIN_EMAILS.some((entry) => entry.toLowerCase() === normalized);
}

export function readAccess(settings: Pick<Settings, "access"> | null | undefined): AccountAccess {
  return {
    disabledAt: settings?.access?.disabledAt || null,
    plan: settings?.access?.plan === "granted" ? "granted" : "none",
  };
}

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  createdAt: string | null;
  onboardedAt: string | null;
  disabledAt: string | null;
  planAccess: AccountAccess["plan"];
  goal: string | null;
  calorieTarget: number | null;
}

export interface AdminUserDetail extends AdminUserSummary {
  age: number | null;
  units: string;
  proteinG: number | null;
  liftingDays: number | null;
}

export interface AdminDirectory {
  users: AdminUserSummary[];
  total: number;
  onboarded: number;
  disabled: number;
  planGranted: number;
  hasMore: boolean;
}
