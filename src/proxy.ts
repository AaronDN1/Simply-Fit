import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/today", "/nutrition", "/training", "/activity", "/progress", "/plan", "/settings", "/onboarding", "/admin"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Local demo mode: auth is enforced client-side.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path)}`;
    return redirectWithSession(to, response);
  }
  if (user && AUTH_PAGES.includes(path)) {
    const to = request.nextUrl.clone();
    to.pathname = "/today";
    to.search = "";
    return redirectWithSession(to, response);
  }
  return response;
}

/** A fresh redirect drops the session cookies Supabase just refreshed. Copy them over. */
function redirectWithSession(to: URL, session: NextResponse) {
  const redirect = NextResponse.redirect(to);
  const setCookies = session.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) redirect.headers.append("set-cookie", cookie);
    return redirect;
  }
  for (const cookie of session.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
