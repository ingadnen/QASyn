import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };
const schema = z.object({ decision: z.enum(["approved", "rejected"]) });

/** POST /api/dashboard/visual-diffs/[id]/approve — approve or reject a diff. */
export async function POST(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const diff = await prisma.visualDiff.findFirst({ where: { id }, include: { baseline: { select: { organisationId: true } } } });
  if (!diff || diff.baseline.organisationId !== ctx.org.id) return jsonError("Diff not found.", 404);
  const updated = await prisma.visualDiff.update({ where: { id: diff.id }, data: { status: parsed.data.decision } });
  await audit(prisma, ctx, "visual.diff_decision", `${diff.id} → ${parsed.data.decision}`);
  return NextResponse.json({ diff: updated });
}
