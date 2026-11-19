const KEY = "simplyfit:impersonate";
const RETURN_KEY = "simplyfit:admin-return";

export interface ImpersonationTarget {
  id: string;
  email: string;
  name: string;
}

export function readImpersonation(): ImpersonationTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<ImpersonationTarget> | null;
    if (!raw || typeof raw.id !== "string" || typeof raw.email !== "string") return null;
    return { id: raw.id, email: raw.email, name: typeof raw.name === "string" ? raw.name : "" };
  } catch {
    return null;
  }
}

export function writeImpersonation(target: ImpersonationTarget | null) {
  if (target) sessionStorage.setItem(KEY, JSON.stringify(target));
  else sessionStorage.removeItem(KEY);
}

/** Set just before impersonation ends, so a not-yet-onboarded admin is not sent through intake. */
export function markAdminReturn() {
  sessionStorage.setItem(RETURN_KEY, "1");
}

export function consumeAdminReturn() {
  const returning = sessionStorage.getItem(RETURN_KEY) === "1";
  if (returning) sessionStorage.removeItem(RETURN_KEY);
  return returning;
}
