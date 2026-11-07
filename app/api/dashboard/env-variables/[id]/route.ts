import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/dashboard/env-variables/[id] */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const variable = await prisma.environmentVariable.findFirst({ where: { id }, include: { environment: { select: { organisationId: true, name: true } } } });
  if (!variable || variable.environment.organisationId !== ctx.org.id) return jsonError("Variable not found.", 404);
  await prisma.environmentVariable.delete({ where: { id: variable.id } });
  await audit(prisma, ctx, "env_variable.deleted", `${variable.environment.name}.${variable.key}`);
  return NextResponse.json({ ok: true });
}
