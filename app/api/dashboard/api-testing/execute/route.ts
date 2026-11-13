import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { executeApiChain, type ApiRequestStep } from "@/lib/engines";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { assertQuotaAvailable, audit, guardApi, quotaErrorResponse, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { apiExecuteSchema } from "@/lib/validation";

/** POST /api/dashboard/api-testing/execute { testId } — sequential chaining engine. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = apiExecuteSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const test = await prisma.apiTest.findFirst({ where: { id: parsed.data.testId, organisationId: ctx.org.id } });
  if (!test) return jsonError("API test not found.", 404);

  let steps: ApiRequestStep[] = [];
  try {
    steps = JSON.parse(test.requestsJson || "[]");
  } catch {
    steps = [];
  }
  if (steps.length === 0) return jsonError("Add at least one request before executing.", 400);

  try {
    await assertQuotaAvailable(prisma, ctx.org.id, 5, ctx.user.id);
  } catch (error) {
    const quota = quotaErrorResponse(error);
    if (quota) return quota;
    throw error;
  }
  await delay(MOCK_LATENCY_MS * 2);
  const results = await executeApiChain(steps);
  const passed = results.every((r) => r.ok);
  const updated = await prisma.apiTest.update({
    where: { id: test.id },
    data: { status: passed ? "passed" : "failed", resultsJson: JSON.stringify(results), lastRunAt: new Date() },
  });
  try {
    await spendCredits(prisma, ctx.org.id, 5, ctx.user.id);
  } catch (error) {
    const quota = quotaErrorResponse(error);
    if (quota) return quota;
    throw error;
  }
  await audit(prisma, ctx, "api_test.execute", `${test.name} · ${results.length} requests · ${passed ? "passed" : "failed"}`);
  return NextResponse.json({ test: updated, results });
}
