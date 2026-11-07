import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;
  const upload = await prisma.upload.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!upload) return jsonError("Upload not found.", 404);
  await prisma.upload.delete({ where: { id: upload.id } });
  await audit(prisma, ctx, "upload.deleted", upload.fileName);
  return NextResponse.json({ ok: true });
}
