import { NextResponse } from "next/server";
import { getRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";
import { createPortal, getStripe } from "@/lib/stripe-server";
import { readBilling } from "@/lib/billing";
import type { Settings } from "@/lib/types";

export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (!auth.configured) return NextResponse.json({ error: "Subscriptions are available on the hosted app." }, { status: 400 });
  if (!auth.user) return NextResponse.json({ error: "Sign in to manage a subscription." }, { status: 401 });
  if (!getStripe() || !getSupabaseAdmin()) return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });

  const admin = getSupabaseAdmin()!;
  const { data, error } = await admin.from("profiles").select("settings").eq("id", auth.user.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Couldn't read your account." }, { status: 500 });
  const customerId = readBilling((data.settings ?? {}) as Settings).customerId;
  if (!customerId) return NextResponse.json({ error: "There's no subscription on this account yet." }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const url = await createPortal(customerId, `${origin}/settings`);
  if (!url) return NextResponse.json({ error: "Couldn't open the billing portal." }, { status: 502 });
  return NextResponse.json({ url });
}
