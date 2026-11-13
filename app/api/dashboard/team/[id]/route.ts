import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { updateMemberSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/team/[id] — change a member's role (org-scoped). */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardPermission("teamManage", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const parsed = updateMemberSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const member = await prisma.user.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!member) return jsonError("Member not found.", 404);
  const updated = await prisma.user.update({ where: { id: member.id }, data: { role: parsed.data.role } });
  await audit(prisma, ctx, "member.role_changed", `${member.email} → ${parsed.data.role}`);
  return NextResponse.json({ member: updated });
}

/** DELETE /api/dashboard/team/[id] — revoke a pending invitation (org-scoped). */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardPermission("teamManage", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;
  const member = await prisma.user.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!member) return jsonError("Member not found.", 404);
  if (member.status !== "invited") return jsonError("Only pending invitations can be revoked.", 409);
  await prisma.user.delete({ where: { id: member.id } });
  await prisma.teamInvite.deleteMany({ where: { organisationId: ctx.org.id, email: member.email, status: "pending" } });
  await audit(prisma, ctx, "member.revoked", member.email);
  return NextResponse.json({ ok: true });
}
