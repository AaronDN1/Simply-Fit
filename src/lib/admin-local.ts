import { readAccess, type AdminDirectory, type AdminUserDetail, type AdminUserSummary } from "./admin";
import { listDemoAccounts, setDemoDisabled } from "./auth";
import { emptySnapshot, readLocalSnapshot, writeLocalSnapshot } from "./data/local";
import { defaultSettings, type AccountAccess, type Settings } from "./types";

function summaryFor(account: ReturnType<typeof listDemoAccounts>[number]): AdminUserSummary {
  const snap = readLocalSnapshot(account.id);
  const access = readAccess(snap?.profile.settings);
  const disabledAt = account.disabledAt ?? access.disabledAt;
  return {
    id: account.id,
    email: account.email,
    name: snap?.profile.displayName || account.name,
    createdAt: account.createdAt ?? snap?.profile.createdAt ?? null,
    onboardedAt: snap?.profile.onboardedAt ?? null,
    disabledAt,
    planAccess: access.plan,
    goal: snap?.profile.intake?.goal ?? null,
    calorieTarget: snap?.profile.plan?.calorieTarget ?? null,
  };
}

export function localAdminDirectory(query: string): AdminDirectory {
  const q = query.trim().toLowerCase();
  const all = listDemoAccounts().map(summaryFor);
  const users = (q ? all.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(q)) : all).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return {
    users,
    total: all.length,
    onboarded: all.filter((user) => user.onboardedAt).length,
    disabled: all.filter((user) => user.disabledAt).length,
    planGranted: all.filter((user) => user.planAccess === "granted").length,
    hasMore: false,
  };
}

export function localAdminDetail(id: string): AdminUserDetail | null {
  const account = listDemoAccounts().find((item) => item.id === id);
  if (!account) return null;
  const base = summaryFor(account);
  const snap = readLocalSnapshot(id);
  return {
    ...base,
    age: snap?.profile.intake?.age ?? null,
    units: snap?.profile.settings.units.weight ?? "lb",
    proteinG: snap?.profile.plan?.proteinG ?? null,
    liftingDays: snap?.profile.plan?.levers.liftingDays ?? snap?.profile.intake?.liftingDaysPerWeek ?? null,
  };
}

export function setLocalAccountAccess(id: string, patch: Partial<AccountAccess>) {
  const account = listDemoAccounts().find((item) => item.id === id);
  if (!account) throw new Error("No account with that id in this browser.");
  if (patch.disabledAt !== undefined) setDemoDisabled(id, patch.disabledAt);
  const snap = readLocalSnapshot(id) ?? emptySnapshot(id, account.email, account.name);
  const access = readAccess(snap.profile.settings);
  const settings: Settings = {
    ...defaultSettings,
    ...snap.profile.settings,
    access: {
      disabledAt: patch.disabledAt !== undefined ? patch.disabledAt : access.disabledAt,
      plan: patch.plan ?? access.plan,
    },
  };
  writeLocalSnapshot({ ...snap, profile: { ...snap.profile, settings } });
}
