import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { pixelHash } from "@/lib/visual-regression";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const baselineSchema = z.object({
  testCaseId: z.string().min(1).max(60),
  stepIndex: z.number().int().min(0),
  screenshotB64: z.string().min(1).max(5_000_000),
  status: z.enum(["approved", "pending", "rejected"]).default("pending"),
});

const diffSchema = z.object({
  baselineId: z.string().min(1).max(60),
  testRunId: z.string().min(1).max(60),
  currentB64: z.string().min(1).max(5_000_000),
});

/** GET /api/dashboard/visual-baselines — baselines of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const baselines = await prisma.visualBaseline.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, include: { diffs: true } });
  return NextResponse.json({ baselines });
}

/** POST /api/dashboard/visual-baselines — create a baseline (hash-computed). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = baselineSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { testCaseId, stepIndex, screenshotB64, status } = parsed.data;
  const tc = await prisma.testCase.findFirst({ where: { id: testCaseId, organisationId: ctx.org.id } });
  if (!tc) return jsonError("Test case not found.", 404);
  const baseline = await prisma.visualBaseline.create({
    data: { organisationId: ctx.org.id, testCaseId, stepIndex, screenshotB64, pixelHash: pixelHash(screenshotB64), status },
  });
  await audit(prisma, ctx, "visual.baseline_created", `${tc.title} · step ${stepIndex + 1}`);
  return NextResponse.json({ baseline }, { status: 201 });
}
