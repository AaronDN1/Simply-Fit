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
