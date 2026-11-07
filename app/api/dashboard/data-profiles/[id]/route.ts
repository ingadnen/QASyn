import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };
const patchSchema = z.object({ name: z.string().trim().min(2).max(80).optional(), rows: z.array(z.record(z.string(), z.string())).max(500).optional() });

/** GET /api/dashboard/data-profiles/[id] */
export async function GET(_request: Request, { params }: Params) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const { id } = await params;
  const profile = await prisma.dataProfile.findFirst({ where: { id, organisationId: guard.ctx.org.id } });
  if (!profile) return jsonError("Profile not found.", 404);
  return NextResponse.json({ profile });
}

/** PATCH /api/dashboard/data-profiles/[id] */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const profile = await prisma.dataProfile.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!profile) return jsonError("Profile not found.", 404);
  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.rows) {
    data.rowsJson = JSON.stringify(parsed.data.rows);
    data.columnsJson = JSON.stringify(parsed.data.rows[0] ? Object.keys(parsed.data.rows[0]) : []);
  }
  const updated = await prisma.dataProfile.update({ where: { id: profile.id }, data });
  await audit(prisma, ctx, "data_profile.updated", updated.name);
  return NextResponse.json({ profile: updated });
}

/** DELETE /api/dashboard/data-profiles/[id] */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const profile = await prisma.dataProfile.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!profile) return jsonError("Profile not found.", 404);
  await prisma.dataProfile.delete({ where: { id: profile.id } });
  await audit(prisma, ctx, "data_profile.deleted", profile.name);
  return NextResponse.json({ ok: true });
}
