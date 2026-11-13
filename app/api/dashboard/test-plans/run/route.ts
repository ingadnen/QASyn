import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { simulateSteps, type NlpStep } from "@/lib/engines";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, spendCredits } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { testPlanRunSchema } from "@/lib/validation";

/**
 * POST /api/dashboard/test-plans/run { planId }
 * Executes every case linked to the plan, either directly or through one of
 * its suites. Persists a TestPlanExecution (resultsJson), a TestRun history
 * row and per-case TestCaseRun entries, then updates plan/suite metrics.
 */

function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function parseSteps(value: string, fallbackId: string): NlpStep[] {
  try {
    const parsed = JSON.parse(value || "[]") as NlpStep[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* fall through */
  }
  return [{ id: `${fallbackId}-1`, action: "Navigate", target: "Verify the application is reachable", value: "", selector: "" }];
}

export async function POST(request: Request) {
  const guard = await guardPermission("plansEdit", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = testPlanRunSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const plan = await prisma.testPlan.findFirst({
    where: { id: parsed.data.planId, organisationId: ctx.org.id },
    include: {
      testCases: true,
      suites: { include: { testCases: true } },
    },
  });
  if (!plan) return jsonError("Test plan not found.", 404);

  // Plan cases ∪ cases from every linked suite (deduplicated).
  const union = new Map(plan.testCases.map((testCase) => [testCase.id, testCase]));
  for (const suite of plan.suites) {
    for (const testCase of suite.testCases) if (!union.has(testCase.id)) union.set(testCase.id, testCase);
  }
  const cases = [...union.values()];
  if (cases.length === 0) return jsonError("This plan has no test cases yet.", 400);

  let browsers: string[] = ["Chromium"];
  try {
    const parsedBrowsers = JSON.parse(plan.browsersJson || '["Chromium"]') as string[];
    if (Array.isArray(parsedBrowsers) && parsedBrowsers.length > 0) browsers = parsedBrowsers;
  } catch {
    /* keep default */
  }
  const viewport = `1440×900 · ${browsers.join(" / ")}`;

  const startedAt = new Date();
  const execution = await prisma.testPlanExecution.create({
    data: {
      organisationId: ctx.org.id,
      testPlanId: plan.id,
      status: "RUNNING",
      triggeredBy: "manual",
      startedAt,
      resultsJson: JSON.stringify({ total: cases.length, viewport }),
    },
  });

  let passed = 0;
  let failed = 0;
  let notExecuted = 0;
  let autoFixed = 0;
  let durationMs = 0;
  const caseResults: Array<{ id: string; title: string; status: string; durationMs: number }> = [];
  const runLogs: Array<{ timestamp: Date; stream: string; tag: string; message: string }> = [];

  for (const testCase of cases) {
    const steps = parseSteps(testCase.stepsJson, testCase.id);
    const { log, healedSteps } = simulateSteps(steps, `${plan.id}:${execution.id}`);
    const healed = log.filter((entry) => entry.healed).length;
    autoFixed += healed;
    const caseDuration = Math.max(180, steps.length * 160 + Math.round(hash01(testCase.id) * 400));
    durationMs += caseDuration;

    // Drafts stay "Not executed"; previously failing cases keep failing,
    // flaky cases are deterministic per execution, everything else passes.
    const roll = hash01(`${execution.id}:${testCase.id}`);
    const status =
      testCase.status === "draft"
        ? "NOT_EXECUTED"
        : testCase.status === "failing" || (testCase.status === "flaky" && roll < 0.5)
          ? "FAILED"
          : "PASSED";

    if (status === "PASSED") passed++;
    else if (status === "FAILED") failed++;
    else notExecuted++;

    caseResults.push({ id: testCase.id, title: testCase.title, status, durationMs: caseDuration });

    if (status !== "NOT_EXECUTED") {
      const previousRuns = await prisma.testCaseRun.count({ where: { organisationId: ctx.org.id, testCaseId: testCase.id } });
      await prisma.testCaseRun.create({
        data: {
          organisationId: ctx.org.id,
          testCaseId: testCase.id,
          runNumber: previousRuns + 1,
          status,
          trigger: "Automated",
          mode: plan.name,
          durationMs: caseDuration,
          failedStep: status === "FAILED" ? log.length : null,
          failedStepText: status === "FAILED" ? log[log.length - 1]?.target ?? null : null,
          autoFix: healed > 0,
          createdBy: ctx.user.email,
          logJson: JSON.stringify(log),
        },
      });
      await prisma.testCase.update({
        where: { id: testCase.id },
        data: {
          status: status === "FAILED" ? "failing" : "passing",
          lastRunAt: new Date(),
          ...(healed > 0 ? { stepsJson: JSON.stringify(healedSteps), stepsCount: healedSteps.length } : {}),
        },
      });
    }

    runLogs.push({
      timestamp: new Date(),
      stream: status === "FAILED" ? "stderr" : "stdout",
      tag: status === "FAILED" ? "FAIL" : status === "NOT_EXECUTED" ? "SKIP" : "TEST",
      message: `${testCase.title} → ${status.toLowerCase().replace("_", " ")}${healed ? ` (${healed} step${healed === 1 ? "" : "s"} auto-healed)` : ""}`,
    });
  }

  const executed = passed + failed;
  const passRate = executed ? Math.round((passed / executed) * 1000) / 10 : 0;
  const finishedAt = new Date();
  durationMs = Math.max(1, durationMs);

  // Release history row (test run evidence).
  const latestRun = await prisma.testRun.findFirst({
    where: { organisationId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    select: { release: true },
  });
  const release = (latestRun?.release ?? 284) + 1;
  const testRun = await prisma.testRun.create({
    data: {
      organisationId: ctx.org.id,
      release,
      version: `2.${release % 10}.0`,
      title: `${plan.name} — ${cases.length} cases`,
      status: failed > 0 ? "FAILED" : "SUCCESS",
      qualityScore: Math.round(passRate),
      coverage: passRate,
      costAvoided: cases.length * 12,
      codeChanges: 0,
      impactedTests: cases.length,
      regressionsCaught: failed,
      anomaliesReproduced: failed,
      testsAdded: 0,
      testsTotal: executed,
      testsPassed: passed,
      durationMs,
      logsJson: JSON.stringify(runLogs),
      planId: plan.id,
      passRate,
      logs: { create: runLogs },
    },
    select: { id: true },
  });

  await prisma.testPlanExecution.update({
    where: { id: execution.id },
    data: {
      status: failed > 0 ? "FAILED" : "PASSED",
      finishedAt,
      resultsJson: JSON.stringify({
        total: cases.length,
        passed,
        failed,
        notExecuted,
        autoFixed,
        durationMs,
        viewport,
        browsers,
        testRunId: testRun.id,
        cases: caseResults,
      }),
    },
  });

  // updateMany tolerates a plan deleted while the run was in flight (no P2025).
  await prisma.testPlan.updateMany({
    where: { id: plan.id, organisationId: ctx.org.id },
    data: { testCasesCount: cases.length, passRate, lastRunAt: finishedAt },
  });

  for (const suite of plan.suites) {
    const suiteCases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id, testSuites: { some: { id: suite.id } } } });
    const suitePassing = suiteCases.filter((testCase) => testCase.status === "passing").length;
    await prisma.testSuite.update({
      where: { id: suite.id },
      data: {
        testCasesCount: suiteCases.length,
        passRate: suiteCases.length ? Math.round((suitePassing / suiteCases.length) * 100) : 0,
        lastRunAt: finishedAt,
      },
    });
  }

  await spendCredits(prisma, ctx.org.id, 5 * cases.length, ctx.user.id);
  await audit(prisma, ctx, "test_plan.run", `${plan.name} · ${cases.length} cases · ${browsers.join("/")} · ${passed} passed · ${failed} failed · ${notExecuted} not executed`);
  return NextResponse.json({
    passed,
    failed,
    total: cases.length,
    notExecuted,
    autoFixed,
    durationMs,
    passRate,
    executionId: execution.id,
    testRunId: testRun.id,
    planId: plan.id,
    viewport,
    browsers,
  });
}
