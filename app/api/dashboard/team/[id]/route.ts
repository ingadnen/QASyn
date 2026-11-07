import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { updateMemberSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const parsed = updateMemberSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const member = await prisma.user.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!member) return jsonError("Member not found.", 404);
  if (member.id === ctx.user.id && parsed.data.role !== "Admin") {
    const admins = await prisma.user.count({ where: { organisationId: ctx.org.id, role: "Admin", status: "active" } });
    if (admins <= 1) return jsonError("You are the only admin. Promote someone else first.", 409);
  }
  await prisma.user.update({ where: { id: member.id }, data: { role: parsed.data.role } });
  await audit(prisma, ctx, "member.role_changed", `${member.email} → ${parsed.data.role}`);
  return NextResponse.json({ ok: true });
}

/** DELETE — removes an invitation, or detaches an active member from the organisation. */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  if (id === ctx.user.id) return jsonError("You can't remove yourself.", 409);
  const member = await prisma.user.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!member) return jsonError("Member not found.", 404);

  if (member.status === "invited" && !member.passwordHash) {
    await prisma.user.delete({ where: { id: member.id } });
  } else {
    await prisma.$transaction([
      prisma.user.update({ where: { id: member.id }, data: { organisationId: null } }),
      prisma.session.updateMany({ where: { userId: member.id, activeOrganisationId: ctx.org.id }, data: { activeOrganisationId: null } }),
    ]);
  }
  await audit(prisma, ctx, "member.removed", member.email);
  return NextResponse.json({ ok: true });
}
