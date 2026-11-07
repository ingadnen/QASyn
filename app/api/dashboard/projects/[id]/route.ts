import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

/** GET /api/dashboard/projects/[id] — single project (org-scoped). */
export async function GET(_request: Request, { params }: Params) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, organisationId: guard.ctx.org.id } });
  if (!project) return jsonError("Project not found.", 404);
  return NextResponse.json({ project });
}

/** PATCH /api/dashboard/projects/[id] — update/archive. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const parsed = z.object({ name: z.string().trim().min(2).max(80).optional(), description: z.string().trim().max(500).optional(), baseUrl: z.string().trim().max(2000).nullable().optional(), archived: z.boolean().optional() }).safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const project = await prisma.project.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!project) return jsonError("Project not found.", 404);
  const updated = await prisma.project.update({ where: { id: project.id }, data: parsed.data });
  await audit(prisma, ctx, "project.updated", updated.name);
  return NextResponse.json({ project: updated });
}

/** DELETE /api/dashboard/projects/[id] */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!project) return jsonError("Project not found.", 404);
  await prisma.project.delete({ where: { id: project.id } });
  await audit(prisma, ctx, "project.deleted", project.name);
  return NextResponse.json({ ok: true });
}
