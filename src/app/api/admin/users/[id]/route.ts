import { NextResponse } from "next/server";
import { hostedUserDetail, requireAdmin, setHostedAccess } from "@/lib/admin-server";
import type { AccountAccess } from "@/lib/types";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await params;
  try {
    const user = await hostedUserDetail(gate.admin, id);
    if (!user) return NextResponse.json({ error: "No account with that id." }, { status: 404 });
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load that account." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { disabled?: boolean; plan?: AccountAccess["plan"] } | null;
  if (!body) return NextResponse.json({ error: "Missing access update." }, { status: 400 });
  const patch: Partial<AccountAccess> = {};
  if (typeof body.disabled === "boolean") patch.disabledAt = body.disabled ? new Date().toISOString() : null;
  if (body.plan === "none" || body.plan === "granted") patch.plan = body.plan;
  try {
    await setHostedAccess(gate.admin, gate.user.id, id, patch);
    const user = await hostedUserDetail(gate.admin, id);
    return NextResponse.json(user);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't update that account." }, { status: 400 });
  }
}
