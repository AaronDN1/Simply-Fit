import { NextResponse } from "next/server";
import { getRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";

/** Permanently deletes the calling user. All rows cascade via foreign keys. */
export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (!auth.configured) return NextResponse.json({ error: "Not available in local demo mode." }, { status: 400 });
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Account deletion isn't configured on this server yet." }, { status: 501 });

  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
