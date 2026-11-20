import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";
import { createCheckout, createPlanPortal, getStripe, rememberCustomer } from "@/lib/stripe-server";
import { readAccess } from "@/lib/admin";
import { accountTier, readBilling } from "@/lib/billing";
import type { Settings } from "@/lib/types";

const Body = z.object({
  plan: z.enum(["free", "paid", "unlimited"]),
  next: z.string().max(200).optional(),
});

function safePath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

function withFlag(path: string, flag: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}billing=${flag}`;
}

export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (!auth.configured) return NextResponse.json({ error: "Subscriptions are available on the hosted app." }, { status: 400 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a plan." }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const next = safePath(parsed.data.next, "/settings");

  if (!auth.user) return NextResponse.json({ error: "Create an account before choosing a paid plan." }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });

  const { data, error } = await admin.from("profiles").select("settings, email, display_name").eq("id", auth.user.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Couldn't read your account." }, { status: 500 });
  const settings = (data.settings ?? {}) as Settings;
  const access = readAccess(settings);
  if (access.plan === "granted") {
    return NextResponse.json({ error: "This account already includes Unlimited." }, { status: 400 });
  }
  if (accountTier(access.plan) === parsed.data.plan) {
    return NextResponse.json({ error: "That's already your plan." }, { status: 409 });
  }

  const billing = readBilling(settings);
  let customerId = billing.customerId;
  if (customerId) {
    const existing = await stripe.customers.retrieve(customerId);
    if (existing.deleted) customerId = null;
  }
  if (!customerId && parsed.data.plan !== "free") {
    const customer = await stripe.customers.create({
      email: (data.email as string) || auth.user.email || undefined,
      name: (data.display_name as string) || undefined,
      metadata: { user_id: auth.user.id },
    });
    customerId = customer.id;
    await rememberCustomer(auth.user.id, customerId);
  }

  const live = customerId
    ? await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 }).then((subs) =>
        subs.data.some((item) => item.status === "active" || item.status === "trialing" || item.status === "past_due")
      )
    : false;

  if (live && customerId) {
    const portal = await createPlanPortal({
      customerId,
      plan: parsed.data.plan,
      returnUrl: `${origin}${withFlag("/settings", "updated")}`,
    });
    if (!portal) return NextResponse.json({ error: "Couldn't open the billing portal." }, { status: 502 });
    return NextResponse.json({ url: portal });
  }

  if (parsed.data.plan === "free") {
    return NextResponse.json({ url: `${origin}/signup` });
  }

  const url = await createCheckout({
    customerId,
    plan: parsed.data.plan,
    successUrl: `${origin}${withFlag(next, "success")}`,
    cancelUrl: `${origin}${withFlag(next, "cancel")}`,
  });
  if (!url) return NextResponse.json({ error: "Couldn't open secure checkout." }, { status: 502 });
  return NextResponse.json({ url });
}
