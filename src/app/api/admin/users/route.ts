import { NextResponse } from "next/server";
import { listHostedUsers, requireAdmin } from "@/lib/admin-server";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  try {
    return NextResponse.json(await listHostedUsers(gate.admin, q, offset));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load accounts." }, { status: 500 });
  }
}
