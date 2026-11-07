import { NextResponse } from "next/server";
import { compareScreenshots, visualVerdict } from "@/lib/visual-regression";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { z } from "zod";

const schema = z.object({
  baselineId: z.string().min(1).max(60),
  testRunId: z.string().min(1).max(60),
  currentB64: z.string().min(1).max(5_000_000),
});

/** POST /api/dashboard/visual-diffs — compare current screenshot vs baseline. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { baselineId, testRunId, currentB64 } = parsed.data;
  const baseline = await prisma.visualBaseline.findFirst({ where: { id: baselineId, organisationId: ctx.org.id } });
  if (!baseline) return jsonError("Baseline not found.", 404);
  const { mismatchPercent } = compareScreenshots(baseline.screenshotB64, currentB64);
  const diff = await prisma.visualDiff.create({
    data: { baselineId, testRunId, diffImageB64: currentB64, mismatchPercent, status: visualVerdict(mismatchPercent) },
  });
  await audit(prisma, ctx, "visual.diff", `mismatch ${mismatchPercent}%`);
  return NextResponse.json({ diff }, { status: 201 });
}
