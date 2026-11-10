import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runTestCases } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { runBatchSchema } from "@/lib/validation";

const MAX_BATCH = 100;

/** POST /api/dashboard/test-cases/run-batch { module? } — runs every (or one module's) test case. */
export async function POST(request: Request) {
  const guard = await guardPermission("testCasesEdit", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = runBatchSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return validationError(parsed.error);
  const { module, testCaseIds } = parsed.data;

  const testCases = await prisma.testCase.findMany({
    where: {
      organisationId: ctx.org.id,
      ...(module ? { module } : {}),
      ...(testCaseIds && testCaseIds.length > 0 ? { id: { in: testCaseIds } } : {}),
    },
    take: MAX_BATCH,
    orderBy: { createdAt: "asc" },
  });
  if (testCases.length === 0) return jsonError("No test cases to run.", 400);

  const remaining = ctx.org.trialCredits - ctx.org.creditsUsed;
  if (remaining <= 0) return jsonError("No credits left. Upgrade your plan in Billing.", 402);

  await delay(MOCK_LATENCY_MS * 2);
  const result = await prisma.$transaction((tx) => runTestCases(tx, ctx, testCases), { timeout: 30_000 });
  await audit(prisma, ctx, "test_case.batch_run", `${module ?? "all modules"} · ${result.passed}/${result.total} passing`);
  return NextResponse.json(result);
}
