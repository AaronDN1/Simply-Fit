import { NextResponse } from "next/server";
import { actAsUser, requireAdmin } from "@/lib/admin-server";

/** Reads and writes one account for an allowlisted admin. The account is not notified. */
export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const body = (await req.json().catch(() => null)) as { userId?: string; op?: string; payload?: unknown } | null;
  if (!body?.userId || !body.op) return NextResponse.json({ error: "Missing account or action." }, { status: 400 });
  if (body.userId === gate.user.id) return NextResponse.json({ error: "Sign in as yourself instead of impersonating your own account." }, { status: 400 });
  try {
    return NextResponse.json(await actAsUser(gate.admin, body.userId, body.op, body.payload));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't act as that account." }, { status: 400 });
  }
}
