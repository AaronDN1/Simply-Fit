import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Handles OAuth, email-confirmation, and password-recovery redirects from Supabase. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/today";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/today";

  const supabase = await getSupabaseServer();
  if (!supabase || !code) return NextResponse.redirect(new URL("/login", url.origin));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("That link has expired. Please try again.")}`, url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
