import { NextResponse } from "next/server";
import { CREDIT_COSTS } from "@/lib/constants";
import { prisma, ensureWal } from "@/lib/db";
import { runTestCases } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { updateTestCaseSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/test-cases/[id] { action: "run" | "set" | "edit" } */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  void ensureWal();
  const { ctx } = guard;
  const { id } = await params;

  const parsed = updateTestCaseSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const tc = await prisma.testCase.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!tc) return jsonError("Test case not found.", 404);
  const input = parsed.data;

  if (input.action === "run") {
    await delay(MOCK_LATENCY_MS * 2);
    const result = await prisma.$transaction((tx) => runTestCases(tx, ctx, [tc]));
    await audit(prisma, ctx, "test_case.run", `${tc.title} · ${result.failed ? "failing" : "passing"}`);
    return NextResponse.json(result);
  }

  if (input.action === "variables") {
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(tc.variablesJson || "{}");
    } catch {
      existing = {};
    }
    const hidden = Object.fromEntries(Object.entries(existing).filter(([key]) => key.startsWith("_")));
    const updated = await prisma.testCase.update({
      where: { id: tc.id },
      data: { variablesJson: JSON.stringify({ ...input.variables, ...hidden }) },
    });
    await audit(prisma, ctx, "test_case.variables", `${tc.title} · ${Object.keys(input.variables).length} vars`);
    return NextResponse.json({ testCase: updated });
  }

  if (input.action === "prerequisites") {
    const prereqs = await prisma.testCase.findMany({
      where: { organisationId: ctx.org.id, id: { in: input.testCaseIds }, NOT: { id: tc.id } },
      select: { id: true },
    });
    let variables: Record<string, unknown> = {};
    try {
      variables = JSON.parse(tc.variablesJson || "{}");
    } catch {
      variables = {};
    }
    variables._prerequisites = prereqs.map((p) => p.id);
    const updated = await prisma.testCase.update({ where: { id: tc.id }, data: { variablesJson: JSON.stringify(variables) } });
    await audit(prisma, ctx, "test_case.prerequisites", `${tc.title} · ${prereqs.length} prerequisites`);
    return NextResponse.json({ testCase: updated, prerequisites: prereqs.map((p) => p.id) });
  }

  if (input.action === "steps") {
    let previous: Array<{ id: string; action: string; target: string; value: string; selector: string }> = [];
    try {
      previous = JSON.parse(tc.stepsJson || "[]");
    } catch {
      previous = [];
    }
    const updated = await prisma.testCase.update({
      where: { id: tc.id },
      data: { stepsJson: JSON.stringify(input.steps), stepsCount: Math.max(1, input.steps.length) },
    });
    const previousTargets = new Set(previous.map((s) => s.target));
    const nextTargets = new Set(input.steps.map((s) => s.target));
    const added = input.steps.filter((s) => !previousTargets.has(s.target)).map((s) => `${s.action}: ${s.target}`);
    const removed = previous.filter((s) => !nextTargets.has(s.target)).map((s) => `${s.action}: ${s.target}`);
    if (added.length || removed.length || previous.length === 0) {
      const versionCount = await prisma.testCaseVersion.count({ where: { testCaseId: tc.id } });
      await prisma.testCaseVersion.create({
        data: {
          organisationId: ctx.org.id,
          testCaseId: tc.id,
          version: versionCount + 1,
          summary: previous.length === 0 ? "Test case created from requirement" : "Bulk operation on steps",
          author: ctx.user.name || "System",
          addedJson: JSON.stringify(added),
          removedJson: JSON.stringify(removed),
          stepsJson: JSON.stringify(input.steps),
        },
      });
    }
    await audit(prisma, ctx, "test_case.steps_updated", `${updated.title} · ${input.steps.length} steps`);
    return NextResponse.json({ testCase: updated });
  }

  if (input.action === "run_steps") {
    let steps: Array<{ id: string; action: string; target: string; value: string; selector: string }> = [];
    try {
      steps = JSON.parse(tc.stepsJson || "[]");
    } catch {
      steps = [];
    }
    if (steps.length === 0) return jsonError("Add at least one step before running.", 400);
    await delay(MOCK_LATENCY_MS * 2);
    // Deterministic simulated execution: failing/flaky cases stop on a middle step
    // unless the AI auto-fix rerun recovers them.
    const shouldFail = !input.autoFix && (tc.status === "failing" || tc.status === "flaky" || tc.status === "draft");
    const failedStep = shouldFail ? Math.max(1, Math.min(steps.length, Math.ceil(steps.length * 0.7))) : null;
    const log = steps.map((s, i) => {
      const stepNo = i + 1;
      const failed = failedStep === stepNo;
      return {
        step: stepNo,
        action: s.action,
        target: s.target,
        status: failed ? "failed" : failedStep && stepNo > failedStep ? "skipped" : "passed",
        healed: !failed && Boolean(input.autoFix) && tc.status === "flaky",
        message: failed
          ? "Assertion failed: expected the target to be visible within 15s."
          : failedStep && stepNo > failedStep
            ? "Skipped after the previous step failed."
            : input.autoFix && tc.status === "flaky"
              ? "Selector re-resolved by AI auto-heal."
              : "OK",
      };
    });
    const now = new Date();
    const status = shouldFail ? "failing" : "passing";
    await prisma.testCase.update({ where: { id: tc.id }, data: { status, lastRunAt: now } });
    for (const suite of await prisma.testSuite.findMany({ where: { organisationId: ctx.org.id, testCases: { some: { id: tc.id } } } })) {
      const members = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id, testSuites: { some: { id: suite.id } } } });
      const passing = members.filter((c) => c.status === "passing").length;
      await prisma.testSuite.update({ where: { id: suite.id }, data: { passRate: members.length ? Math.round((passing / members.length) * 100) : 0, lastRunAt: now } });
    }
    for (const plan of await prisma.testPlan.findMany({ where: { organisationId: ctx.org.id, testCases: { some: { id: tc.id } } } })) {
      const members = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id, testPlans: { some: { id: plan.id } } } });
      const passing = members.filter((c) => c.status === "passing").length;
      await prisma.testPlan.update({ where: { id: plan.id }, data: { passRate: members.length ? Math.round((passing / members.length) * 100) : 0, lastRunAt: now } });
    }
    const durationMs = 36_000 + steps.length * 1_900;
    const lastRun = await prisma.testCaseRun.findFirst({ where: { organisationId: ctx.org.id }, orderBy: { runNumber: "desc" }, select: { runNumber: true } });
    const createdRun = await prisma.testCaseRun.create({
      data: {
        organisationId: ctx.org.id,
        testCaseId: tc.id,
        runNumber: (lastRun?.runNumber ?? 0) + 1,
        status: shouldFail ? "FAILED" : "PASSED",
        trigger: "Automated",
        mode: "Standalone Run",
        durationMs,
        failedStep,
        failedStepText: failedStep ? steps[failedStep - 1]?.target ?? null : null,
        autoFix: Boolean(input.autoFix),
        createdBy: ctx.user.name || "System",
        logJson: JSON.stringify(log),
      },
    });
    if (input.autoFix) {
      const versionCount = await prisma.testCaseVersion.count({ where: { testCaseId: tc.id } });
      await prisma.testCaseVersion.create({
        data: {
          organisationId: ctx.org.id,
          testCaseId: tc.id,
          version: versionCount + 1,
          summary: "Auto-fix (attempt 1)",
          author: "System",
          addedJson: "[]",
          removedJson: "[]",
          stepsJson: JSON.stringify(steps),
        },
      });
    }
    await spendCredits(prisma, ctx.org.id, CREDIT_COSTS.testRun);
    await audit(prisma, ctx, "test_case.run_steps", `${tc.title} · ${log.length} steps · ${shouldFail ? "failing" : "passing"}`);
    return NextResponse.json({ result: { passed: shouldFail ? 0 : 1, failed: shouldFail ? 1 : 0, total: 1 }, log, run: createdRun });
  }

  await delay(MOCK_LATENCY_MS / 2);
  const data =
    input.action === "set"
      ? { status: input.status }
      : {
          title: input.title ?? tc.title,
          module: input.module ?? tc.module,
          criticality: input.criticality ?? tc.criticality,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.labels !== undefined ? { labelsJson: JSON.stringify(input.labels) } : {}),
          ...(input.environment !== undefined ? { environment: input.environment || null } : {}),
          ...(input.version !== undefined ? { version: input.version } : {}),
          ...(input.platform !== undefined ? { platform: input.platform } : {}),
        };
  const updated = await prisma.testCase.update({ where: { id: tc.id }, data });
  await audit(prisma, ctx, input.action === "set" ? "test_case.status" : "test_case.updated", `${updated.title}${input.action === "set" ? ` → ${input.status}` : ""}`);
  return NextResponse.json({ testCase: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const tc = await prisma.testCase.findFirst({ where: { id, organisationId: ctx.org.id }, include: { requirements: { select: { id: true } } } });
  if (!tc) return jsonError("Test case not found.", 404);
  await prisma.testCase.delete({ where: { id: tc.id } });
  for (const r of tc.requirements) {
    const count = await prisma.testCase.count({ where: { requirements: { some: { id: r.id } } } });
    await prisma.requirement.update({
      where: { id: r.id },
      data: { linkedTestsCount: count, coverageStatus: count === 0 ? "uncovered" : count === 1 ? "partial" : "covered" },
    });
  }
  await audit(prisma, ctx, "test_case.deleted", tc.title);
  return NextResponse.json({ ok: true });
}
