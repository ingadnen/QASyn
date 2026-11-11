import type { CrawlSession, Prisma, PrismaClient, TestCase } from "@prisma/client";
import { biviaBoolean } from "./bivia";
import { CREDIT_COSTS } from "./constants";
import { context7Guidance } from "./context7";
import { buildCrawlLogs, crawlPlan, crawlProgress, hostFromUrl } from "./crawl";
import { prisma } from "./db";
import { parseIntegrationConfig, type IntegrationConfig } from "./integration-providers";
import {
  generateGroundedTitles,
  generatedStepEvidenceSvgBase64,
  groundedFlowsFromDom,
  groundedStepsForFlow,
  inspectTargetDom,
  type GroundedFlow,
  type TargetDomSnapshot,
} from "./web-executor";
import { audit, readSettings, spendCredits, type OrgContext } from "./tenant";
import {
  buildStepHealMetadata,
  healSelectorWithBivia,
  isCorruptSelector,
  isHealableAction,
  syntheticDomSummary,
} from "./selector-healing";
import { normalizeWebsite } from "./utils";

/**
 * Simulated AQE engine. Everything is local: no request ever leaves the server
 * (crawls, PR analyses and test runs are derived from the organisation's own data).
 */

type Db = PrismaClient | Prisma.TransactionClient;
type Actor = Pick<OrgContext, "org" | "user">;

const PENDING_MS = 6000;

export async function startCrawl(db: Db, actor: Actor, targetUrl: string, opts?: { platform?: string; publishMode?: string; testTypes?: string[]; prerequisites?: string[]; explorePrompt?: string; additionalContext?: string; requirementName?: string; createSuite?: boolean; createPlan?: boolean }): Promise<CrawlSession> {
  const running = await db.crawlSession.findFirst({ where: { organisationId: actor.org.id, status: "running" } });
  if (running) return running;
  const logs = buildCrawlLogs(targetUrl);
  if (opts?.explorePrompt?.trim()) {
    logs.splice(1, 0, { offsetMs: 150, tag: "MAP", message: `Explore prompt: ${opts.explorePrompt.trim()}` });
  }
  if (opts?.additionalContext?.trim()) {
    logs.splice(2, 0, { offsetMs: 180, tag: "INFO", message: opts.additionalContext.trim() });
  }
  const crawl = await db.crawlSession.create({
    data: {
      organisationId: actor.org.id,
      targetUrl,
      status: "running",
      logs: JSON.stringify(logs),
      publishMode: opts?.publishMode ?? "Require approval",
      testTypesJson: JSON.stringify(opts?.testTypes ?? []),
      prerequisitesJson: JSON.stringify(opts?.prerequisites ?? []),
      explorePrompt: opts?.explorePrompt ?? "",
      additionalContext: opts?.additionalContext ?? "",
      createSuite: opts?.createSuite ?? false,
      createPlan: opts?.createPlan ?? false,
    },
  });
  // Auto-create the associated requirement (REQ-00X <date>_crawl)
  const count = await db.requirement.count({ where: { organisationId: actor.org.id } });
  const code = `REQ-${String(count + 1).padStart(3, "0")}`;
  const requirementTitle = opts?.requirementName?.trim() || `${new Date().toISOString().slice(0, 10)}_crawl — ${hostFromUrl(targetUrl)}`;
  const requirement = await db.requirement
    .create({ data: { organisationId: actor.org.id, code, title: requirementTitle, source: "doc", coverageStatus: "uncovered" } })
    .catch(() => null);
  if (requirement) {
    await db.crawlSession.update({ where: { id: crawl.id }, data: { requirementId: requirement.id } });
  }
  await spendCredits(db, actor.org.id, CREDIT_COSTS.crawl);
  await audit(db, actor, "crawl.started", hostFromUrl(targetUrl));
  return crawl;
}

/** Blends the deterministic crawl plan with flows discovered in the real DOM. */
async function groundedCrawlPlan(targetUrl: string): Promise<{ host: string; seed: number; pages: string[]; flows: Array<GroundedFlow & { pages: string[] }>; snapshot: TargetDomSnapshot | null }> {
  const plan = crawlPlan(targetUrl);
  const snapshot = await inspectTargetDom(targetUrl);
  const grounded = groundedFlowsFromDom(snapshot).map((flow) => ({ ...flow, pages: ["/"] }));
  const simulated = plan.flows.map((flow) => ({ ...flow, description: `Simulated flow mapped from ${targetUrl}.` }));
  const seen = new Set<string>();
  const flows = [...grounded, ...simulated].filter((flow) => {
    const key = flow.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { host: plan.host, seed: plan.seed, pages: plan.pages, flows, snapshot };
}

/** "Complete Crawl Now": finishes the crawl and turns mapped flows into the first test cases. */
export async function completeCrawl(db: Db, actor: Actor, crawl: CrawlSession) {
  if (crawl.status !== "running") return { created: 0 };
  const { pages, flows, host, snapshot } = await groundedCrawlPlan(crawl.targetUrl);

  const existing = new Set(
    (await db.testCase.findMany({ where: { organisationId: actor.org.id }, select: { title: true } })).map((t) => t.title),
  );
  const fresh = flows.filter((f) => !existing.has(f.name));
    if (fresh.length > 0) {
      await db.testCase.createMany({
        data: fresh.map((flow) => ({
          organisationId: actor.org.id,
          title: flow.name,
          module: flow.module,
          criticality: flow.criticality,
          status: "draft",
          stepsCount: Math.max(1, flow.steps),
          source: "crawl",
          stepsJson: JSON.stringify(groundedStepsForFlow(snapshot, crawl.targetUrl, flow.name, Math.max(1, flow.steps))),
          variablesJson: JSON.stringify({ url: crawl.targetUrl }),
        })),
      });
    }

  const logs = [
    ...buildCrawlLogs(crawl.targetUrl).slice(0, -1),
    { offsetMs: 0, tag: "DONE", message: `Crawl complete · ${pages.length} pages · ${flows.length} flows · ${fresh.length} test cases generated` },
  ];
  await db.crawlSession.update({
    where: { id: crawl.id },
    data: { status: "completed", completedAt: new Date(), pagesVisited: pages.length, flowsMapped: flows.length, logs: JSON.stringify(logs) },
  });

  const kb = await db.knowledgeItem.findFirst({ where: { organisationId: actor.org.id, type: "website", urlOrPath: crawl.targetUrl } });
  if (!kb) {
    await db.knowledgeItem.create({
      data: { organisationId: actor.org.id, title: `${host} (crawl)`, type: "website", urlOrPath: crawl.targetUrl, status: "indexed" },
    });
  }
  // Create the Test Suite / Test Plan when requested (toggles) or on Auto publish.
  const wantsSuite = crawl.createSuite || crawl.publishMode === "Auto publish";
  const wantsPlan = crawl.createPlan || crawl.publishMode === "Auto publish";
  if ((wantsSuite || wantsPlan) && fresh.length > 0) {
    const created = await db.testCase.findMany({ where: { organisationId: actor.org.id, title: { in: fresh.map((c) => c.name) } } });
    let suiteId: string | null = null;
    if (wantsSuite) {
      const suite = await db.testSuite.create({
        data: { organisationId: actor.org.id, name: `${host} crawl suite`, description: `Generated from crawl ${crawl.targetUrl}`, testCasesCount: created.length, passRate: 0, testCases: { connect: created.map((c) => ({ id: c.id })) } },
      });
      suiteId = suite.id;
      await audit(db, actor, "crawl.suite_created", `${suite.name} · ${created.length} cases`);
    }
    if (wantsPlan) {
      const plan = await db.testPlan.create({
        data: {
          organisationId: actor.org.id,
          name: `${host} crawl plan`,
          environment: "Staging",
          testCasesCount: created.length,
          passRate: 0,
          testCases: { connect: created.map((c) => ({ id: c.id })) },
          ...(suiteId ? { suites: { connect: [{ id: suiteId }] } } : {}),
        },
      });
      await audit(db, actor, "crawl.plan_created", plan.name);
    }
  }
  // Link generated cases back to the auto-created Requirement so coverage shows immediately.
  if (crawl.requirementId && fresh.length > 0) {
    const created = await db.testCase.findMany({ where: { organisationId: actor.org.id, title: { in: fresh.map((c) => c.name) } } });
    await db.requirement.update({
      where: { id: crawl.requirementId },
      data: {
        linkedTestsCount: created.length,
        coverageStatus: created.length > 0 ? "covered" : "uncovered",
        testCases: { connect: created.map((c) => ({ id: c.id })) },
      },
    });
    await audit(db, actor, "crawl.requirement_linked", `${created.length} cases → requirement`);
  }
  await audit(db, actor, "crawl.completed", `${host} · ${fresh.length} test cases`);
  return { created: fresh.length };
}

/** Live counters of a running crawl (derived from elapsed time). */
export function crawlLiveStats(crawl: CrawlSession) {
  if (crawl.status !== "running") return { pagesVisited: crawl.pagesVisited, flowsMapped: crawl.flowsMapped };
  const p = crawlProgress(crawl.targetUrl, Date.now() - crawl.startedAt.getTime());
  return { pagesVisited: p.pagesVisited, flowsMapped: p.flowsMapped };
}

/** Re-import: regenerate the crawl's mapped flows into test cases, updating existing ones. */
export async function reimportCrawl(db: Db, actor: Actor, crawl: CrawlSession) {
  const { pages, flows, host, snapshot } = await groundedCrawlPlan(crawl.targetUrl);
  const existing = await db.testCase.findMany({
    where: { organisationId: actor.org.id, title: { in: flows.map((flow) => flow.name) } },
  });
  const byTitle = new Map(existing.map((testCase) => [testCase.title, testCase]));
  let created = 0;
  let updated = 0;
  const linkedIds: string[] = [];

  for (const flow of flows) {
    const steps = Math.max(1, flow.steps);
    const stepsJson = JSON.stringify(groundedStepsForFlow(snapshot, crawl.targetUrl, flow.name, steps));
    const current = byTitle.get(flow.name);
    if (current) {
      await db.testCase.update({
        where: { id: current.id },
        data: { stepsJson, stepsCount: steps, status: "draft", lastRunAt: null, source: "crawl" },
      });
      linkedIds.push(current.id);
      updated++;
    } else {
      const testCase = await db.testCase.create({
        data: {
          organisationId: actor.org.id,
          title: flow.name,
          module: flow.module,
          criticality: flow.criticality,
          status: "draft",
          stepsCount: steps,
          source: "crawl",
          stepsJson,
          variablesJson: JSON.stringify({ url: crawl.targetUrl }),
        },
      });
      linkedIds.push(testCase.id);
      created++;
    }
  }

  const logs = [
    ...buildCrawlLogs(crawl.targetUrl).slice(0, -1),
    { offsetMs: 0, tag: "DONE", message: `Re-import complete · ${pages.length} pages · ${flows.length} flows · ${created} created · ${updated} refreshed` },
  ];
  await db.crawlSession.update({
    where: { id: crawl.id },
    data: { status: "completed", completedAt: new Date(), pagesVisited: pages.length, flowsMapped: flows.length, logs: JSON.stringify(logs) },
  });

  if (crawl.requirementId) {
    await db.requirement.update({
      where: { id: crawl.requirementId },
      data: {
        linkedTestsCount: linkedIds.length,
        coverageStatus: linkedIds.length > 0 ? "covered" : "uncovered",
        testCases: { set: linkedIds.map((id) => ({ id })) },
      },
    });
  }
  await audit(db, actor, "crawl.reimported", `${host} · ${created} created · ${updated} refreshed`);
  return { created, updated, total: flows.length };
}

/** Generate requirement-derived test cases and link them to the requirement. */
export async function generateRequirementCases(db: Db, actor: Actor, requirement: { id: string; title: string; code: string; source: string }, count = 3) {
  const targetUrl = resolveTargetUrl(actor.org.website, null);
  const snapshot = await inspectTargetDom(targetUrl);
  const fallback = generateTitles("Core", requirement.title, count);
  const titles = await generateGroundedTitles(snapshot, "Core", requirement.title, count, fallback);
  const existing = new Set((await db.testCase.findMany({ where: { organisationId: actor.org.id }, select: { title: true } })).map((t) => t.title));
  const created: TestCase[] = [];
  for (const base of titles) {
    let title = base;
    let suffix = 2;
    while (existing.has(title)) title = `${base} (${suffix++})`;
    existing.add(title);
    const steps = 4 + (created.length % 3);
    created.push(
      await db.testCase.create({
        data: {
          organisationId: actor.org.id,
          title,
          module: "Core",
          criticality: "high",
          status: "draft",
          stepsCount: steps,
          source: requirement.source === "crawl" ? "crawl" : "ai",
          stepsJson: JSON.stringify(groundedStepsForFlow(snapshot, targetUrl, title, steps)),
          variablesJson: JSON.stringify({ requirement: requirement.code }),
        },
      }),
    );
  }
  const countAfter = await db.testCase.count({ where: { organisationId: actor.org.id, requirements: { some: { id: requirement.id } } } });
  const linkedTotal = countAfter + created.length;
  await db.requirement.update({
    where: { id: requirement.id },
    data: {
      linkedTestsCount: linkedTotal,
      coverageStatus: linkedTotal > 1 ? "covered" : linkedTotal === 1 ? "partial" : "uncovered",
      testCases: { connect: created.map((t) => ({ id: t.id })) },
    },
  });
  await audit(db, actor, "requirement.generated", `${requirement.code} · ${created.length} cases`);
  return { created: created.length, linked: linkedTotal };
}
const ROOT_CAUSES = [
  "stale token in auth/refresh.ts:87",
  "race condition between cart update and price recalculation",
  "missing null check on optional billing address",
  "selector changed after design refresh (data-testid removed)",
  "timeout waiting for payment provider sandbox",
  "locale-dependent date parsing in invoices",
];

/** Runs test cases (simulated): updates status/lastRunAt, creates a TestRun+LogLine trail, files reproduced bugs, recalculates suite/plan pass rates. */
export async function runTestCases(
  db: Db,
  actor: Actor,
  testCases: TestCase[],
  options: { targetUrl?: string; trigger?: string; mode?: string; deterministic?: boolean } = {},
) {
  let passed = 0;
  let failed = 0;
  let healedCases = 0;
  const now = new Date();
  const logLines: Array<{ timestamp: Date; stream: string; tag: string; message: string }> = [];
  const caseResults: Array<{
    id: string;
    title: string;
    status: string;
    runId: string;
    runNumber: number;
    screenshotBase64: string;
    logJson: string;
  }> = [];
  const targetUrl = normalizeWebsite(options.targetUrl ?? "") ?? "";

  // Bivia configuration is resolved through the transaction client (never the
  // global Prisma client) so callers can wrap runTestCases in a transaction.
  const analysisCode = readSettings(actor.org).analysisCode ?? null;
  let biviaIntegrationConfig: IntegrationConfig | null = null;
  try {
    const row = await db.integration.findUnique({
      where: { organisationId_provider: { organisationId: actor.org.id, provider: "BIVIA" } },
      select: { configJson: true },
    });
    biviaIntegrationConfig = row ? parseIntegrationConfig(row.configJson) : null;
  } catch {
    biviaIntegrationConfig = null;
  }
  const biviaSources = { integrationConfig: biviaIntegrationConfig, analysisCode };
  const biviaAiEnabled = analysisCode?.biviaVerifyAi !== false;

  for (const tc of testCases) {
    const roll = options.deterministic
      ? tc.status === "flaky"
        ? 0.5
        : tc.status === "failing"
          ? 0
          : 0.9
      : Math.random();
    const failRate = tc.status === "flaky" ? 0.35 : tc.criticality === "low" ? 0.08 : 0.14;
    let status = roll < failRate ? "failing" : roll < failRate + 0.04 ? "flaky" : "passing";
    if (status === "failing") failed++;
    else passed++;

    // Execute every AI Assertion step through Articul8 Bivia and persist the
    // calibrated status, probability and abstain reason on the step itself.
    const biviaNotes: string[] = [];
    let stepsChanged = false;
    let steps: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(tc.stepsJson || "[]") as unknown;
      if (Array.isArray(parsed)) steps = parsed.filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === "object");
    } catch {
      steps = [];
    }

    // Phase 8 — closed-loop autonomous self-healing. A corrupt selector is
    // re-grounded with Bivia `/choice` + `/ground`, the step is repaired and
    // the run becomes a passing auto-fix run documented in Version History.
    const healedDetails: Array<{ oldSelector: string; newSelector: string; probabilityPct: number }> = [];
    if (steps.length > 0) {
      const summarySteps = steps.map((step) => ({
        action: String(step.action ?? ""),
        target: String(step.target ?? ""),
        value: String(step.value ?? ""),
        selector: String(step.selector ?? ""),
      }));
      const navigateTarget = summarySteps.find((step) => step.action === "Navigate")?.target ?? "";
      for (const step of steps) {
        const action = String(step.action ?? "");
        const oldSelector = String(step.selector ?? "");
        if (!isHealableAction(action) || !isCorruptSelector(oldSelector)) continue;
        const target = String(step.target ?? "");
        const decision = await healSelectorWithBivia({
          step: { action, target, value: String(step.value ?? ""), selector: oldSelector },
          domSummary: syntheticDomSummary(tc.title, summarySteps),
          url: navigateTarget,
          organisationId: actor.org.id,
          sources: biviaSources,
        });
        if (decision.status !== "healed" || !decision.newSelector) continue;
        step.selector = decision.newSelector;
        step.status = "passed";
        step.biviaHeal = buildStepHealMetadata(decision, now.toISOString());
        healedDetails.push({
          oldSelector: oldSelector || "(empty)",
          newSelector: decision.newSelector,
          probabilityPct: decision.probabilityPct,
        });
        stepsChanged = true;
        biviaNotes.push(
          `✨ Healed by Bivia ${decision.probabilityPct.toFixed(1)}% calibrated · ${oldSelector || "(empty)"} → ${decision.newSelector}`,
        );
      }
    }
    if (healedDetails.length > 0) {
      if (status === "failing") {
        failed--;
        passed++;
      }
      status = "passing";
      healedCases++;
    }

    if (biviaAiEnabled) {
      for (const step of steps) {
        if (String(step.action ?? "") !== "AI Assertion") continue;
        const question = String(step.target ?? "").trim() || `Verify ${tc.title}`;
        const decision = await biviaBoolean({
          question,
          context: [
            `Test case: ${tc.title}`,
            `Module: ${tc.module}`,
            `Criticality: ${tc.criticality}`,
            `Step: ${question}`,
            `Existing selector context: ${String(step.selector ?? "") || "(auto-resolved)"}`,
          ].join("\n"),
          organisationId: actor.org.id,
          sources: biviaSources,
          allowAbstain: true,
        });
        const probabilityPct = Math.round(decision.probability * 1000) / 10;
        const stepStatus =
          decision.status === "abstained" ? "abstained" : decision.value ? "passed" : "failed";
        step.status = stepStatus;
        step.bivia = {
          status: stepStatus,
          probability: probabilityPct,
          probabilityRaw: decision.probability,
          provider: decision.provider,
          question,
          latencyMs: decision.latencyMs,
          verifiedAt: now.toISOString(),
          ...(decision.abstainReason ? { abstainReason: decision.abstainReason } : {}),
        };
        stepsChanged = true;
        biviaNotes.push(
          `🧠 Bivia ${probabilityPct.toFixed(1)}% calibrated · ${stepStatus}${decision.abstainReason ? ` · ${decision.abstainReason}` : ""}`,
        );
      }
    }

    // PR auto-regression executes the same cases against the deployed URL.
    if (targetUrl) {
      for (const step of steps) {
        if (String(step.action ?? "") === "Navigate") step.target = targetUrl;
      }
    }

    // Deliverable 1: every executed step keeps visual evidence, including
    // deterministic runs where Chromium is not launched. Real Playwright PNG
    // screenshots captured by `executeWebSteps` are preserved; the generated
    // viewport is only used as the offline fallback.
    const runLog = steps.map((step, index) => {
      const action = String(step.action ?? "");
      const target = String(step.target ?? "");
      const healed = Boolean(step.biviaHeal) || Boolean((step.biviaHeal as { healed?: boolean } | undefined)?.healed);
      const stepStatus = String(
        step.status ?? (status === "failing" && index === steps.length - 1 ? "failed" : healed ? "passed" : "passed"),
      );
      const existingEvidence =
        typeof step.screenshotBase64 === "string" && step.screenshotBase64.startsWith("data:image/")
          ? step.screenshotBase64
          : null;
      const evidence =
        existingEvidence ??
        generatedStepEvidenceSvgBase64({
          title: tc.title,
          action,
          target,
          status: stepStatus,
          url: targetUrl || String(steps.find((entry) => String(entry.action ?? "") === "Navigate")?.target ?? ""),
          stepNumber: index + 1,
          detail: healed ? "Bivia re-resolved this locator; visual evidence persisted." : String(step.message ?? "Executed by the QASyn deterministic engine."),
          capturedAt: now.toISOString(),
        });
      step.status = stepStatus;
      step.screenshotBase64 = evidence;
      step.screenshotMime = existingEvidence ? step.screenshotMime ?? "image/png" : "image/svg+xml";
      step.lastScreenshot = evidence;
      step.screenshot = evidence;
      step.lastRunStatus = stepStatus;
      step.lastRunAt = now.toISOString();
      return {
        step: index + 1,
        action,
        target,
        status: stepStatus,
        healed,
        message: healed
          ? "Selector re-resolved by Bivia · visual evidence attached."
          : stepStatus === "failed"
            ? "Assertion failed: expected the target to be visible within 15s. Screenshot attached."
            : "OK · screenshot attached.",
        screenshotBase64: evidence,
        screenshotMime: existingEvidence ? step.screenshotMime ?? "image/png" : "image/svg+xml",
        screenshot: evidence,
        lastScreenshot: evidence,
      };
    });
    stepsChanged = steps.length > 0;

    await db.testCase.update({
      where: { id: tc.id },
      data: { status, lastRunAt: now, ...(stepsChanged ? { stepsJson: JSON.stringify(steps) } : {}) },
    });
    // Per-test-case run trail (Studio run history) with screenshot evidence.
    const lastCaseRun = await db.testCaseRun.findFirst({
      where: { testCaseId: tc.id },
      orderBy: { runNumber: "desc" },
      select: { runNumber: true },
    });
    const runNumber = (lastCaseRun?.runNumber ?? 0) + 1;
    const failedStep = status === "failing" || status === "flaky" ? Math.max(1, runLog.length) : null;
    const caseRun = await db.testCaseRun.create({
      data: {
        organisationId: actor.org.id,
        testCaseId: tc.id,
        runNumber,
        status: status === "failing" || status === "flaky" ? "FAILED" : "PASSED",
        trigger: options.trigger ?? "Automated",
        mode: options.mode ?? "Standalone Run",
        durationMs: 12_000 + runLog.length * 1_400,
        failedStep,
        failedStepText: failedStep ? String(steps[failedStep - 1]?.target ?? "") || null : null,
        autoFix: healedDetails.length > 0,
        createdBy: healedDetails.length > 0 ? "Articul8 Bivia" : "System",
        logJson: JSON.stringify(runLog),
      },
    });
    caseResults.push({
      id: tc.id,
      title: tc.title,
      status,
      runId: caseRun.id,
      runNumber,
      screenshotBase64: String(runLog[0]?.screenshotBase64 ?? ""),
      logJson: JSON.stringify(runLog),
    });
    if (healedDetails.length > 0) {
      const versionCount = await db.testCaseVersion.count({ where: { testCaseId: tc.id } });
      const first = healedDetails[0];
      await db.testCaseVersion.create({
        data: {
          organisationId: actor.org.id,
          testCaseId: tc.id,
          version: versionCount + 1,
          summary: `✨ Bivia self-healed selector: ${first.oldSelector} → ${first.newSelector} (${first.probabilityPct.toFixed(1)}% calibrated)`,
          author: "Articul8 Bivia",
          addedJson: JSON.stringify(healedDetails.map((entry) => entry.newSelector)),
          removedJson: JSON.stringify(healedDetails.map((entry) => entry.oldSelector)),
          stepsJson: JSON.stringify(steps),
        },
      });
    }
    logLines.push({
      timestamp: now,
      stream: status === "failing" ? "stderr" : "stdout",
      tag: status === "failing" ? "FAIL" : "TEST",
      message: `${tc.title} → ${status}${biviaNotes.length ? ` · ${biviaNotes.join(" · ")}` : ""}`,
    });

    if (status === "failing" && tc.status !== "failing") {
      await db.bugReport.create({
        data: {
          organisationId: actor.org.id,
          title: `${tc.title} fails`,
          severity: tc.criticality,
          status: "reproduced",
          source: "test_run",
          reproductionSteps: [
            `Open the ${tc.module} module`,
            `Run "${tc.title}" (${tc.stepsCount} steps)`,
            "Observe the assertion failure on the final step",
          ].join("\n"),
          rootCause: ROOT_CAUSES[Math.floor(Math.random() * ROOT_CAUSES.length)],
          environment: "Default environment",
          videoUrl: `/evidence/${tc.id}.webm`,
        },
      });
    }
  }
  // Executable trail: a real TestRun row with per-case LogLine entries.
  const total = testCases.length;
  const passRate = total ? Math.round((passed / total) * 100) : 0;
  const runRows = await db.testRun.findMany({ where: { organisationId: actor.org.id }, orderBy: { createdAt: "desc" }, take: 1 });
  const release = (runRows[0]?.release ?? 284) + 1;
  await db.testRun.create({
    data: {
      organisationId: actor.org.id,
      release,
      version: `2.${release % 10}.0`,
      title: healedCases > 0 ? `✨ Auto-fix rerun — ${total} case${total === 1 ? "" : "s"}` : `Manual run — ${total} cases`,
      status: failed > 0 ? "FAILED" : "SUCCESS",
      qualityScore: passRate,
      coverage: passRate,
      costAvoided: total * 12,
      codeChanges: 0,
      impactedTests: total,
      regressionsCaught: failed,
      anomaliesReproduced: failed,
      testsAdded: 0,
      testsTotal: total,
      testsPassed: passed,
      evidenceJson: JSON.stringify(
        healedCases > 0 ? [{ type: "bivia-auto-fix", autoFixed: true, healedCases, at: now.toISOString() }] : [],
      ),
      durationMs: logLines.length * 120,
      logsJson: JSON.stringify(logLines),
      passRate,
      logs: { create: logLines },
    },
  });
  // Recalculate pass rates for suites/plans containing these cases.
  for (const suite of await db.testSuite.findMany({ where: { organisationId: actor.org.id, testCases: { some: { id: { in: testCases.map((t) => t.id) } } } } })) {
    const cases = await db.testCase.findMany({ where: { organisationId: actor.org.id, testSuites: { some: { id: suite.id } } } });
    const passing = cases.filter((c) => c.status === "passing").length;
    await db.testSuite.update({ where: { id: suite.id }, data: { testCasesCount: cases.length, passRate: cases.length ? Math.round((passing / cases.length) * 100) : 0, lastRunAt: now } });
  }
  for (const plan of await db.testPlan.findMany({ where: { organisationId: actor.org.id, testCases: { some: { id: { in: testCases.map((t) => t.id) } } } } })) {
    const cases = await db.testCase.findMany({ where: { organisationId: actor.org.id, testPlans: { some: { id: plan.id } } } });
    const passing = cases.filter((c) => c.status === "passing").length;
    await db.testPlan.update({ where: { id: plan.id }, data: { testCasesCount: cases.length, passRate: cases.length ? Math.round((passing / cases.length) * 100) : 0, lastRunAt: now } });
  }
  await spendCredits(db, actor.org.id, CREDIT_COSTS.testRun * testCases.length);
  return { passed, failed, total: testCases.length, results: caseResults };
}

const AI_TEMPLATES: Record<string, string[]> = {
  Core: ["Log in with valid credentials", "Reject invalid password", "Log out from the user menu", "Session expires after inactivity"],
  Billing: ["Download the latest invoice", "Apply a discount code", "Cancel a subscription", "Show VAT for EU customers"],
  Settings: ["Rename the workspace", "Invite a teammate", "Toggle e-mail notifications", "Rotate an API token"],
  Checkout: ["Pay with a saved card", "Handle declined payment", "Edit shipping address at checkout", "Guest checkout"],
};

const E2E_TITLES = [
  "End-to-End Navigation and Sign-In Flow",
  "Account Recovery and Validation Flow",
  "Header Navigation and Language Localization",
  "Session Persistence and Security Check",
  "Search and Catalog Browsing Flow",
  "Shopping Cart and Checkout Completion",
  "User Profile and Settings Management",
  "Error Handling and Form Validation Flow",
];

export function generateTitles(module: string, prompt: string, count: number): string[] {
  const safeModule = module === "all" || !module ? "Core" : module;
  const base = AI_TEMPLATES[safeModule] ?? E2E_TITLES;
  const focusRaw = prompt.trim().replace(/\s+/g, " ");
  const generic = /^(all|any|none|n\/?a|test|tests|crawl|e2e)$/i.test(focusRaw);
  const focus = !generic && focusRaw.length >= 8 ? focusRaw.slice(0, 60) : "";
  const titles = (focus ? [...E2E_TITLES, ...base].map((t) => `${t} — ${focus}`) : [...E2E_TITLES, ...base]);
  const unique = [...new Set(titles)];
  return unique.slice(0, Math.max(1, Math.min(count, unique.length)));
}

export interface NlpStepLike {
  id: string;
  action: string;
  target: string;
  value: string;
  selector: string;
  /** Context7 live-doc rules injected at generation time (Playwright/Next.js). */
  context7?: string;
}

const LEGACY_URL_PATTERN = /https?:\/\/(?:[a-z0-9-]+\.)*acme\.example(?::\d+)?(?:\/[^\s"',)\]]*)?|https?:\/\/(?:[a-z0-9-]+\.)*example\.com(?::\d+)?(?:\/[^\s"',)\]]*)?/gi;
const LEGACY_HOST_PATTERN = /(?:[a-z0-9-]+\.)*acme\.example|(?:[a-z0-9-]+\.)*example\.com/gi;

/**
 * The Target URL used by every creation flow. An explicit target always wins;
 * the organisation website is the fallback. "acme.example" is never injected.
 */
export function resolveTargetUrl(input: string | null | undefined, orgUrl: string | null | undefined): string {
  return normalizeWebsite(input ?? "") ?? normalizeWebsite(orgUrl ?? "") ?? "http://localhost:3000";
}

function replaceLegacyUrls(value: string, base: string, host: string): string {
  return value
    .replace(LEGACY_URL_PATTERN, base)
    .replace(LEGACY_HOST_PATTERN, host);
}

/**
 * Repairs test cases created before the Target URL fix: any acme.example or
 * example.com URL is replaced by the organisation's real website. Acme's own
 * demo workspace is intentionally skipped.
 */
export async function repairLegacyTestUrls(organisationId: string, website: string | null | undefined): Promise<number> {
  const base = normalizeWebsite(website ?? "");
  if (!base) return 0;
  const host = base.replace(/^https?:\/\//, "");
  if (/acme\.example|example\.com/i.test(host)) return 0;

  const candidates = await prisma.testCase.findMany({
    where: {
      organisationId,
      OR: [
        { stepsJson: { contains: "acme.example" } },
        { stepsJson: { contains: "example.com" } },
        { variablesJson: { contains: "acme.example" } },
        { variablesJson: { contains: "example.com" } },
        { description: { contains: "acme.example" } },
        { description: { contains: "example.com" } },
      ],
    },
    select: { id: true, stepsJson: true, variablesJson: true, description: true },
  });
  if (candidates.length === 0) return 0;

  for (const testCase of candidates) {
    let stepsJson = testCase.stepsJson;
    try {
      const steps = JSON.parse(testCase.stepsJson || "[]") as Array<Record<string, unknown>>;
      if (Array.isArray(steps)) {
        stepsJson = JSON.stringify(
          steps.map((step) => ({
            ...step,
            target: typeof step.target === "string" ? replaceLegacyUrls(step.target, base, host) : step.target,
            value: typeof step.value === "string" ? replaceLegacyUrls(step.value, base, host) : step.value,
          })),
        );
      }
    } catch {
      stepsJson = replaceLegacyUrls(testCase.stepsJson, base, host);
    }

    let variablesJson = testCase.variablesJson;
    try {
      const variables = JSON.parse(testCase.variablesJson || "{}") as Record<string, unknown>;
      if (!variables || typeof variables !== "object" || Array.isArray(variables)) throw new Error("invalid");
      variables.url = base;
      variablesJson = JSON.stringify(variables);
    } catch {
      variablesJson = JSON.stringify({ url: base });
    }

    await prisma.testCase.update({
      where: { id: testCase.id },
      data: {
        stepsJson,
        variablesJson,
        ...(testCase.description ? { description: replaceLegacyUrls(testCase.description, base, host) } : {}),
      },
    });
  }
  return candidates.length;
}

/** Context7 rules injected into step generation (Playwright + Next.js). */
export function buildContext7GenerationContext(module: string, title = ""): string {
  return context7Guidance(`playwright nextjs e2e ${module} ${title}`.trim(), 3);
}

/** Builds exactly `count` realistic NLP steps anchored on the organisation URL. */
export function buildStepsJson(orgUrl: string, count: number, module: string, title = ""): string {
  const base = normalizeWebsite((orgUrl || "").trim()) ?? "";
  const host = base ? base.replace(/^https?:\/\//, "") : "the application";
  const goTo = base || "the application";
  const context7 = buildContext7GenerationContext(module, title);
  const flows: Array<[string, string, string]> = [
    ["Navigate", `Navigate to ${goTo}`, ""],
    ["Verify Element", base ? `Verify that the current page URL contains ${host}` : "Verify that the application home page is displayed", ""],
    ["Click", "Click on the primary navigation link", ""],
    ["AI Assertion", "Verify that the main heading is visible", ""],
    ["Enter Text", `Enter ${title || "test value"} in the search field`, ""],
    ["Click", `Click on ${module} module link`, ""],
    ["AI Assertion", `Verify that the ${module.toLowerCase()} page loads correctly`, ""],
    ["Click", "Click on the submit button", ""],
    ["Verify Element", "Verify the confirmation message is visible", ""],
    ["Navigate", `Navigate to ${base ? `${base}/settings` : "the settings page"}`, ""],
  ];
  const steps: NlpStepLike[] = Array.from({ length: Math.max(1, count) }, (_, i) => {
    const [action, target, value] = flows[i % flows.length];
    return {
      id: `s${i + 1}`,
      action,
      target: action === "Navigate" && i > 0 && i % 5 === 4 ? `${base}/settings` : target,
      value,
      selector: "",
      ...(action === "AI Assertion" ? { context7 } : {}),
    };
  });
  return JSON.stringify(steps);
}

/** Lazy state transitions (PR analysis, KB indexing, integration indexing). */
export async function settlePending(organisationId: string) {
  const cutoff = new Date(Date.now() - PENDING_MS);
  const prs = await prisma.pullRequestCheck.findMany({ where: { organisationId, status: "running", createdAt: { lte: cutoff } } });
  for (const pr of prs) {
    const tests = await prisma.testCase.count({ where: { organisationId } });
    const regression = pr.riskLevel === "high" ? true : pr.riskLevel === "medium" ? pr.prNumber % 2 === 0 : false;
    await prisma.pullRequestCheck.update({
      where: { id: pr.id },
      data: {
        status: regression ? "regression_caught" : "passed_baseline",
        regressions: regression ? 1 + (pr.filesChanged % 3) : 0,
        testsRun: Math.min(tests, Math.max(1, Math.round(pr.filesChanged * 1.5))),
      },
    });
  }
  await prisma.knowledgeItem.updateMany({ where: { organisationId, status: "indexing", updatedAt: { lte: cutoff } }, data: { status: "indexed" } });
  await prisma.integration.updateMany({
    where: { organisationId, status: "INDEXING", updatedAt: { lte: new Date(Date.now() - 8000) } },
    data: { status: "CONNECTED" },
  });
}

export function riskFromFiles(filesChanged: number): "low" | "medium" | "high" {
  return filesChanged >= 25 ? "high" : filesChanged >= 8 ? "medium" : "low";
}
