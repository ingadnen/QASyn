import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { environmentUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/environments/[id] { action: "default" } */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const parsed = environmentUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const env = await prisma.environmentConfig.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!env) return jsonError("Environment not found.", 404);
  await prisma.$transaction([
    prisma.environmentConfig.updateMany({ where: { organisationId: ctx.org.id }, data: { isDefault: false } }),
    prisma.environmentConfig.update({ where: { id: env.id }, data: { isDefault: true } }),
  ]);
  await audit(prisma, ctx, "environment.default", env.name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;
  const env = await prisma.environmentConfig.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!env) return jsonError("Environment not found.", 404);
  await prisma.environmentConfig.delete({ where: { id: env.id } });
  if (env.isDefault) {
    const next = await prisma.environmentConfig.findFirst({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.environmentConfig.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  await audit(prisma, ctx, "environment.deleted", env.name);
  return NextResponse.json({ ok: true });
}
