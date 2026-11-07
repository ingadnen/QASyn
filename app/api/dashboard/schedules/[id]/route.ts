import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/schedules/[id] — enable/disable or rename. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const parsed = z.object({ enabled: z.boolean().optional(), name: z.string().trim().min(2).max(80).optional() }).safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const schedule = await prisma.schedule.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!schedule) return jsonError("Schedule not found.", 404);
  const updated = await prisma.schedule.update({ where: { id: schedule.id }, data: parsed.data });
  await audit(prisma, ctx, "schedule.updated", updated.name);
  return NextResponse.json({ schedule: updated });
}

/** DELETE /api/dashboard/schedules/[id] */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const schedule = await prisma.schedule.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!schedule) return jsonError("Schedule not found.", 404);
  await prisma.schedule.delete({ where: { id: schedule.id } });
  await audit(prisma, ctx, "schedule.deleted", schedule.name);
  return NextResponse.json({ ok: true });
}
