import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { simulateMobileRun, type Gesture } from "@/lib/engines";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { assertQuotaAvailable, audit, guardApi, quotaErrorResponse, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { mobileRunSchema } from "@/lib/validation";

/** POST /api/dashboard/mobile/run — simulate execution on the device grid. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = mobileRunSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const test = await prisma.mobileTest.findFirst({ where: { id: parsed.data.testId, organisationId: ctx.org.id } });
  if (!test) return jsonError("Mobile test not found.", 404);

  try {
    await assertQuotaAvailable(prisma, ctx.org.id, 5, ctx.user.id);
  } catch (error) {
    const quota = quotaErrorResponse(error);
    if (quota) return quota;
    throw error;
  }
  await delay(MOCK_LATENCY_MS * 2);
  let gestures: Gesture[] = [];
  try {
    gestures = JSON.parse(test.gesturesJson || "[]");
  } catch {
    gestures = [];
  }
  const { log, passed } = simulateMobileRun(test.device, gestures);
  const updated = await prisma.mobileTest.update({
    where: { id: test.id },
    data: { status: passed ? "passed" : "failed", logsJson: JSON.stringify(log), lastRunAt: new Date() },
  });
  try {
    await spendCredits(prisma, ctx.org.id, 5, ctx.user.id);
  } catch (error) {
    const quota = quotaErrorResponse(error);
    if (quota) return quota;
    throw error;
  }
  await audit(prisma, ctx, "mobile.run", `${test.name} · ${test.device} · ${passed ? "passed" : "failed"}`);
  return NextResponse.json({ test: updated, log });
}
