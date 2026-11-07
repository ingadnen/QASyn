import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { updateMemberSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/team/[id] — change a member's role (org-scoped). */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
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
