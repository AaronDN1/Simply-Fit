"use client";

import { getSupabaseBrowser } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";
import { uid } from "./utils";
import { removeLocalSnapshot } from "./data/local";
import { isAdminEmail } from "./admin";
import { readImpersonation, writeImpersonation } from "./impersonation";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export const authMode: "supabase" | "demo" = isSupabaseConfigured ? "supabase" : "demo";

/* ---------------- Local demo accounts (browser only) ---------------- */

interface DemoAccount {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  disabledAt?: string | null;
  createdAt?: string;
}
const ACCOUNTS_KEY = "simplyfit:accounts";
const SESSION_KEY = "simplyfit:session";
const SUPABASE_REMEMBER_KEY = "simplyfit:supabase-remember";

async function hash(pw: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`simplyfit:${pw}`));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readAccounts(): DemoAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeAccounts(list: DemoAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

function storedSessionId() {
  return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
}

function clearSupabasePersistence() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("sb-") && key.endsWith("-auth-token")) localStorage.removeItem(key);
  }
}

function saveDemoSession(id: string, remember: boolean) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, id);
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}

/* ---------------- Public API ---------------- */

/** The account that actually signed in. Impersonation does not change this. */
export async function getSessionUser(): Promise<AuthUser | null> {
  if (sessionStorage.getItem(SUPABASE_REMEMBER_KEY) === "0") {
    clearSupabasePersistence();
    sessionStorage.removeItem(SUPABASE_REMEMBER_KEY);
  }
  const sb = getSupabaseBrowser();
  if (sb) {
    // Read the cookie session. getUser() would refresh the token, and the proxy already does that on navigation.
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    return { id: u.id, email: u.email ?? "", name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? "" };
  }
  const id = storedSessionId();
  const acc = readAccounts().find((a) => a.id === id);
  return acc ? { id: acc.id, email: acc.email, name: acc.name } : null;
}

/** The account the app should load. An allowlisted admin may be viewing someone else. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSessionUser();
  if (!session) return null;
  const impersonating = readImpersonation();
  if (!impersonating) return session;
  if (!isAdminEmail(session.email) || impersonating.id === session.id) {
    writeImpersonation(null);
    return session;
  }
  return { id: impersonating.id, email: impersonating.email, name: impersonating.name };
}

export function listDemoAccounts() {
  return readAccounts().map(({ id, email, name, disabledAt, createdAt }) => ({
    id,
    email,
    name,
    disabledAt: disabledAt ?? null,
    createdAt: createdAt ?? null,
  }));
}

export function setDemoDisabled(id: string, disabledAt: string | null) {
  const accounts = readAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) throw new Error("No local account with that id.");
  if (disabledAt && isAdminEmail(acc.email)) throw new Error("Allowlisted administrators stay active.");
  acc.disabledAt = disabledAt;
  writeAccounts(accounts);
}

function assertNotImpersonating() {
  if (readImpersonation()) throw new Error("End impersonation before changing sign-in details.");
}

export async function signUpWithEmail(email: string, password: string, name: string) {
  const sb = getSupabaseBrowser();
  if (sb) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding` },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }
  const accounts = readAccounts();
  if (accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) throw new Error("An account with this email already exists.");
  const acc: DemoAccount = { id: uid(), email, name, passwordHash: await hash(password), createdAt: new Date().toISOString() };
  writeAccounts([...accounts, acc]);
  saveDemoSession(acc.id, true);
  return { needsConfirmation: false };
}

export async function signInWithEmail(email: string, password: string, remember = true) {
  const sb = getSupabaseBrowser();
  if (sb) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const banned = /banned|disabled/i.test(error.message);
      throw new Error(banned ? "This account is disabled." : error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
    }
    if (!remember) clearSupabasePersistence();
    return;
  }
  const acc = readAccounts().find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (!acc || acc.passwordHash !== (await hash(password))) throw new Error("That email and password don't match.");
  if (acc.disabledAt) throw new Error("This account is disabled.");
  saveDemoSession(acc.id, remember);
}

export async function signInWithGoogle(next = "/today", remember = true) {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("Google sign-in needs Supabase to be configured. Use email to try the local demo.");
  sessionStorage.setItem(SUPABASE_REMEMBER_KEY, remember ? "1" : "0");
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) throw new Error(error.message);
}

export async function sendPasswordReset(email: string) {
  const sb = getSupabaseBrowser();
  if (sb) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback?next=/reset-password` });
    if (error) throw new Error(error.message);
    return;
  }
  // Demo mode has no email delivery; the reset page lets the signed-in demo user set a new password.
}

export async function updatePassword(password: string, demoEmail?: string) {
  assertNotImpersonating();
  const sb = getSupabaseBrowser();
  if (sb) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    return;
  }
  const accounts = readAccounts();
  const id = storedSessionId();
  const acc = accounts.find((a) => (demoEmail ? a.email.toLowerCase() === demoEmail.toLowerCase() : a.id === id));
  if (!acc) throw new Error("No local account found for that email.");
  acc.passwordHash = await hash(password);
  writeAccounts(accounts);
}

export async function updateEmail(email: string) {
  assertNotImpersonating();
  const sb = getSupabaseBrowser();
  if (sb) {
    const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: `${siteUrl()}/auth/callback?next=/settings` });
    if (error) throw new Error(error.message);
    return { needsConfirmation: true };
  }
  const accounts = readAccounts();
  const acc = accounts.find((a) => a.id === storedSessionId());
  if (acc) {
    acc.email = email;
    writeAccounts(accounts);
  }
  return { needsConfirmation: false };
}

export async function linkedProviders(): Promise<string[]> {
  const sb = getSupabaseBrowser();
  if (!sb) return ["email"];
  const { data } = await sb.auth.getUser();
  return (data.user?.identities ?? []).map((i) => i.provider);
}

export async function linkGoogle() {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("Connecting Google needs Supabase to be configured.");
  const { error } = await sb.auth.linkIdentity({ provider: "google", options: { redirectTo: `${siteUrl()}/auth/callback?next=/settings` } });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  writeImpersonation(null);
  const sb = getSupabaseBrowser();
  if (sb) await sb.auth.signOut();
  else {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export async function accessToken() {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function deleteAccount() {
  assertNotImpersonating();
  const sb = getSupabaseBrowser();
  if (sb) {
    const token = await accessToken();
    const res = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't delete your account.");
    await sb.auth.signOut();
    return;
  }
  const id = storedSessionId();
  if (id) {
    writeAccounts(readAccounts().filter((a) => a.id !== id));
    removeLocalSnapshot(id);
  }
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

/** Creates (or re-enters) a local demo account. Used by "Try the demo". */
export async function startDemoSession() {
  const email = "demo@simplyfit.app";
  const accounts = readAccounts();
  let acc = accounts.find((a) => a.email === email);
  if (!acc) {
    acc = { id: uid(), email, name: "Alex", passwordHash: await hash("demo-password") };
    writeAccounts([...accounts, acc]);
  }
  saveDemoSession(acc.id, true);
  return { id: acc.id, email: acc.email, name: acc.name };
}
