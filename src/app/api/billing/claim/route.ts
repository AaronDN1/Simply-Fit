import { NextResponse } from "next/server";
import { getRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";
import { claimCustomerForUser, getStripe } from "@/lib/stripe-server";

export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (!auth.user || !getStripe() || !getSupabaseAdmin()) return NextResponse.json({ attached: false });
  const attached = await claimCustomerForUser(auth.user.id, auth.user.email ?? "");
  return NextResponse.json({ attached });
}
