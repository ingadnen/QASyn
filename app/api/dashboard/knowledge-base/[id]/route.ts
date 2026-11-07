import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/knowledge-base/[id] — re-index (simulated). */
export async function PATCH(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;
  const item = await prisma.knowledgeItem.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!item) return jsonError("Source not found.", 404);
  await prisma.knowledgeItem.update({ where: { id: item.id }, data: { status: "indexing" } });
  await audit(prisma, ctx, "knowledge.reindexed", item.title);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;
  const item = await prisma.knowledgeItem.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!item) return jsonError("Source not found.", 404);
  await prisma.knowledgeItem.delete({ where: { id: item.id } });
  await audit(prisma, ctx, "knowledge.removed", item.title);
  return NextResponse.json({ ok: true });
}
