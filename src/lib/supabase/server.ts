import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

export async function getSupabaseServer() {
  if (!isSupabaseConfigured) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS — only use after verifying the caller. */
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Profile fields the AI routes are allowed to use when cloud AI is on. */
export async function loadOwnAiProfile(req: Request, userId: string) {
  const header = req.headers.get("authorization");
  const supabase =
    header?.startsWith("Bearer ")
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false },
          global: { headers: { Authorization: header } },
        })
      : await getSupabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("settings, intake").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  const settings = (data.settings ?? {}) as { privacy?: { aiUsesHistory?: boolean } };
  const intake = (data.intake ?? {}) as { dietaryPreferences?: unknown; allergies?: unknown };
  return {
    aiUsesHistory: settings.privacy?.aiUsesHistory !== false,
    dietaryPreferences: Array.isArray(intake.dietaryPreferences) ? intake.dietaryPreferences.filter((item): item is string => typeof item === "string") : [],
    allergies: typeof intake.allergies === "string" ? intake.allergies : "",
  };
}

/**
 * Resolve the calling user from cookies or a Bearer token.
 * Returns `{ user: null, configured: false }` in local demo mode.
 */
export async function getRequestUser(req: Request) {
  if (!isSupabaseConfigured) return { configured: false as const, user: null, token: null };
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await anon.auth.getUser(token);
    return { configured: true as const, user: data.user ?? null, token };
  }
  const supabase = await getSupabaseServer();
  const { data } = await supabase!.auth.getUser();
  return { configured: true as const, user: data.user ?? null, token: null };
}
