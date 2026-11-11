import { NextResponse } from "next/server";
import { CREDIT_COSTS } from "@/lib/constants";
import { prisma, ensureWal } from "@/lib/db";
import { runTestCases } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { parseIntegrationConfig } from "@/lib/integration-providers";
import { buildStepHealMetadata, healSelectorWithBivia, isHealableAction, syntheticDomSummary } from "@/lib/selector-healing";
import { audit, guardApi, readSettings, spendCredits } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { updateTestCaseSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/test-cases/[id] { action: "run" | "set" | "edit" } */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardPermission("testCasesEdit", { write: true });
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
    const result = await prisma.$transaction((tx) => runTestCases(tx, ctx, [tc]), { timeout: 60_000 });
    await audit(prisma, ctx, "test_case.run", `${tc.title} · ${result.failed ? "failing" : "passing"}`);
    return NextResponse.json(result);
  }

  if (input.action === "clone") {
    if (input.folderId) {
      const folder = await prisma.testFolder.findFirst({ where: { id: input.folderId, organisationId: ctx.org.id }, select: { id: true } });
      if (!folder) return jsonError("Folder not found.", 404);
    }
    const clone = await prisma.testCase.create({
      data: {
        organisationId: ctx.org.id,
        title: input.title?.trim() || `${tc.title} (Copy)`,
        module: tc.module,
        description: tc.description,
        labelsJson: tc.labelsJson,
        criticality: tc.criticality,
        status: "draft",
        environment: tc.environment,
        version: tc.version,
        platform: tc.platform,
        stepsCount: tc.stepsCount,
        stepsJson: tc.stepsJson,
        assertionsJson: tc.assertionsJson,
        variablesJson: tc.variablesJson,
        dataProfileId: tc.dataProfileId,
        projectId: tc.projectId,
        folderId: input.folderId === undefined ? tc.folderId : input.folderId,
        source: "manual",
      },
    });
    await prisma.testCaseVersion.create({
      data: {
        organisationId: ctx.org.id,
        testCaseId: clone.id,
        version: 1,
        summary: `Cloned from ${tc.title}`,
        author: ctx.user.name || "System",
        stepsJson: tc.stepsJson,
      },
    });
    await audit(prisma, ctx, "test_case.cloned", `${tc.title} → ${clone.title}`);
    return NextResponse.json({ testCase: clone });
  }

  if (input.action === "move") {
    if (input.folderId) {
      const folder = await prisma.testFolder.findFirst({ where: { id: input.folderId, organisationId: ctx.org.id }, select: { id: true } });
      if (!folder) return jsonError("Folder not found.", 404);
    }
    const updated = await prisma.testCase.update({ where: { id: tc.id }, data: { folderId: input.folderId } });
    await audit(prisma, ctx, "test_case.moved", `${tc.title} → ${input.folderId ? "folder" : "unfiled"}`);
    return NextResponse.json({ testCase: updated });
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

  if (input.action === "simulate_self_heal") {
    await delay(MOCK_LATENCY_MS);
    let steps: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(tc.stepsJson || "[]") as unknown;
      if (Array.isArray(parsed)) steps = parsed.filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === "object");
    } catch {
      steps = [];
    }

    // Pick the requested/healable step, or append a Click step that is seeded
    // with the deliberately broken legacy selector.
    let index = input.stepId ? steps.findIndex((step) => String(step.id ?? "") === input.stepId) : -1;
    if (index < 0) index = steps.findIndex((step) => isHealableAction(String(step.action ?? "")));
    if (index < 0) {
      steps.push({
        id: `s${Date.now()}`,
        action: "Click",
        target: "Click the primary call-to-action",
        value: "",
        selector: "#broken-legacy-selector-999",
      });
      index = steps.length - 1;
    }
    const broken = steps[index];
    if (!isHealableAction(String(broken.action ?? ""))) broken.action = "Click";
    const oldSelector = "#broken-legacy-selector-999";
    broken.selector = oldSelector;
    const action = String(broken.action ?? "Click");
    const target = String(broken.target ?? "the primary call-to-action");
    const value = String(broken.value ?? "");

    // Bivia sources resolved through the global client; this route is not in a transaction.
    const analysisCode = readSettings(ctx.org).analysisCode ?? null;
    let integrationConfig = null;
    try {
      const row = await prisma.integration.findUnique({
        where: { organisationId_provider: { organisationId: ctx.org.id, provider: "BIVIA" } },
        select: { configJson: true },
      });
      integrationConfig = row ? parseIntegrationConfig(row.configJson) : null;
    } catch {
      integrationConfig = null;
    }
    const navigateStep = steps.find((step) => String(step.action ?? "") === "Navigate");
    const navigateTarget = String(navigateStep?.target ?? "");
    const summarySteps = steps.map((step) => ({
      action: String(step.action ?? ""),
      target: String(step.target ?? ""),
      value: String(step.value ?? ""),
      selector: String(step.selector ?? ""),
    }));
    const decision = await healSelectorWithBivia({
      step: { action, target, value, selector: oldSelector },
      domSummary: syntheticDomSummary(tc.title, summarySteps),
      url: navigateTarget || ctx.org.website || "",
      organisationId: ctx.org.id,
      sources: { integrationConfig, analysisCode },
    });
    if (decision.status !== "healed" || !decision.newSelector) {
      return jsonError(decision.abstainReason || "Bivia could not calibrate a replacement selector.", 422);
    }

    const metadata = buildStepHealMetadata(decision);
    broken.selector = decision.newSelector;
    broken.status = "passed";
    broken.biviaHeal = metadata;
    const now = new Date();
    const log = steps.map((step, stepIndex) => ({
      step: stepIndex + 1,
      action: String(step.action ?? ""),
      target: String(step.target ?? ""),
      status: "passed",
      healed: stepIndex === index,
      message:
        stepIndex === index
          ? `Selector re-resolved by Bivia (${decision.probabilityPct.toFixed(1)}% calibrated): ${oldSelector} → ${decision.newSelector}`
          : "OK",
    }));
    const { updated, run, version } = await prisma.$transaction(
      async (tx) => {
        const updated = await tx.testCase.update({
          where: { id: tc.id },
          data: { status: "passing", lastRunAt: now, stepsJson: JSON.stringify(steps), stepsCount: Math.max(1, steps.length) },
        });
        // Run numbers are per test case, matching Studio's run history.
        const lastRun = await tx.testCaseRun.findFirst({
          where: { testCaseId: tc.id },
          orderBy: { runNumber: "desc" },
          select: { runNumber: true },
        });
        const run = await tx.testCaseRun.create({
          data: {
            organisationId: ctx.org.id,
            testCaseId: tc.id,
            runNumber: (lastRun?.runNumber ?? 0) + 1,
            status: "PASSED",
            trigger: "Self-Healing",
            mode: "Bivia Auto-Heal",
            durationMs: 18_400 + steps.length * 1_900,
            failedStep: index + 1,
            failedStepText: `${action}: ${target} — ${oldSelector} not found`,
            autoFix: true,
            createdBy: "Articul8 Bivia",
            logJson: JSON.stringify(log),
          },
        });
        const versionCount = await tx.testCaseVersion.count({ where: { testCaseId: tc.id } });
        const version = await tx.testCaseVersion.create({
          data: {
            organisationId: ctx.org.id,
            testCaseId: tc.id,
            version: versionCount + 1,
            summary: `✨ Bivia self-healed selector: ${oldSelector} → ${decision.newSelector} (${decision.probabilityPct.toFixed(1)}% calibrated)`,
            author: "Articul8 Bivia",
            addedJson: JSON.stringify([decision.newSelector]),
            removedJson: JSON.stringify([oldSelector]),
            stepsJson: JSON.stringify(steps),
          },
        });
        await spendCredits(tx, ctx.org.id, CREDIT_COSTS.testRun);
        return { updated, run, version };
      },
      { timeout: 30_000 },
    );
    await audit(
      prisma,
      ctx,
      "test_case.self_healed",
      `${tc.title} · ${oldSelector} → ${decision.newSelector} · ${decision.probabilityPct.toFixed(1)}%`,
    );
    return NextResponse.json({
      healed: true,
      steps,
      run,
      version,
      testCase: updated,
      oldSelector,
      newSelector: decision.newSelector,
      probabilityPct: decision.probabilityPct,
      probability: decision.probability,
      provider: decision.provider,
      strategy: decision.strategy,
      grounding: decision.grounding,
      decision: {
        status: decision.status,
        oldSelector: decision.oldSelector,
        newSelector: decision.newSelector,
        probability: decision.probability,
        probabilityPct: decision.probabilityPct,
        provider: decision.provider,
        latencyMs: decision.latencyMs,
        strategy: decision.strategy,
        abstainReason: decision.abstainReason,
      },
    });
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
  const guard = await guardPermission("testCasesEdit", { write: true });
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
