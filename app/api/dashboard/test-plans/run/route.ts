import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { simulateSteps, type NlpStep } from "@/lib/engines";
import { executeWebSteps } from "@/lib/web-executor";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { testPlanRunSchema } from "@/lib/validation";

/**
 * POST /api/dashboard/test-plans/run { planId }
 * Simulated ContextQA execution pipeline: for every test case of the plan,
 * run each NLP step, auto-heal UI drift (🩹), persist repaired stepsJson,
 * and return detailed logs per step.
 */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = testPlanRunSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const plan = await prisma.testPlan.findFirst({
    where: { id: parsed.data.planId, organisationId: ctx.org.id },
    include: { testCases: true },
  });
  if (!plan) return jsonError("Test plan not found.", 404);
  if (plan.testCases.length === 0) return jsonError("This plan has no test cases yet.", 400);

  await delay(MOCK_LATENCY_MS * 2);
  const browsers: string[] = JSON.parse(plan.browsersJson || '["Chromium"]');
  const cases: Array<{ id: string; title: string; log: ReturnType<typeof simulateSteps>["log"]; healed: number; real: Awaited<ReturnType<typeof executeWebSteps>> }> = [];
  let totalPassed = 0;
  let totalSteps = 0;

  for (const tc of plan.testCases) {
    let steps: NlpStep[] = [];
    try {
      steps = JSON.parse(tc.stepsJson || "[]");
    } catch {
      steps = [];
    }
    if (steps.length === 0) {
      steps = [{ id: `${tc.id}-1`, action: "Navigate", target: tc.title, value: "", selector: "" }];
    }
    const { log, healedSteps } = simulateSteps(steps, plan.id);
    const healed = log.filter((l) => l.healed).length;
    totalPassed += log.filter((l) => l.status !== "failed").length;
    totalSteps += log.length;
    // Real HTTP/DOM execution with similarity-based healing (Playwright when installed).
    const real = await executeWebSteps(healedSteps);
    cases.push({ id: tc.id, title: tc.title, log, healed, real });
    await prisma.testCase.update({
      where: { id: tc.id },
      data: { stepsJson: JSON.stringify(healedSteps), stepsCount: healedSteps.length, status: healed > 0 ? "flaky" : "passing", lastRunAt: new Date() },
    });
  }

  const passRate = totalSteps ? Math.round((totalPassed / totalSteps) * 1000) / 10 : 0;
  const updated = await prisma.testPlan.update({
    where: { id: plan.id },
    data: { testCasesCount: plan.testCases.length, passRate, lastRunAt: new Date() },
  });
  await spendCredits(prisma, ctx.org.id, 5 * plan.testCases.length);
  await audit(prisma, ctx, "test_plan.run", `${plan.name} · ${plan.testCases.length} cases · ${browsers.join("/")} · ${passRate}%`);
  return NextResponse.json({ plan: updated, browsers, cases, passRate });
}
