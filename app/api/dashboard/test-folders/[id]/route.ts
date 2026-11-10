import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { testFolderSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/test-folders/[id] — rename or recolour a folder. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const parsed = testFolderSchema.partial().safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const folder = await prisma.testFolder.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!folder) return jsonError("Folder not found.", 404);
  if (parsed.data.name && parsed.data.name !== folder.name) {
    const clash = await prisma.testFolder.findFirst({ where: { organisationId: ctx.org.id, name: parsed.data.name } });
    if (clash) return jsonError("A folder with this name already exists.", 409);
  }

  const updated = await prisma.testFolder.update({
    where: { id: folder.id },
    data: { ...(parsed.data.name ? { name: parsed.data.name } : {}), ...(parsed.data.color ? { color: parsed.data.color } : {}) },
  });
  await audit(prisma, ctx, "test_folder.updated", updated.name);
  return NextResponse.json({ folder: updated });
}

/** DELETE /api/dashboard/test-folders/[id] — cases inside become unfiled. */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const folder = await prisma.testFolder.findFirst({ where: { id, organisationId: ctx.org.id }, include: { _count: { select: { testCases: true } } } });
  if (!folder) return jsonError("Folder not found.", 404);
  await prisma.testFolder.delete({ where: { id: folder.id } });
  await audit(prisma, ctx, "test_folder.deleted", `${folder.name} · ${folder._count.testCases} cases unfiled`);
  return NextResponse.json({ ok: true, id: folder.id, unfiled: folder._count.testCases });
}
