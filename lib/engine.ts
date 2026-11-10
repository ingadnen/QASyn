import type { CrawlSession, Prisma, PrismaClient, TestCase } from "@prisma/client";
import { CREDIT_COSTS } from "./constants";
import { buildCrawlLogs, crawlPlan, crawlProgress, hostFromUrl } from "./crawl";
import { prisma } from "./db";
import {
  generateGroundedTitles,
  groundedFlowsFromDom,
  groundedStepsForFlow,
  inspectTargetDom,
  type GroundedFlow,
  type TargetDomSnapshot,
} from "./web-executor";
import { audit, spendCredits, type OrgContext } from "./tenant";
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
export async function runTestCases(db: Db, actor: Actor, testCases: TestCase[]) {
  let passed = 0;
  let failed = 0;
  const now = new Date();
  const logLines: Array<{ timestamp: Date; stream: string; tag: string; message: string }> = [];
  for (const tc of testCases) {
    const roll = Math.random();
    const failRate = tc.status === "flaky" ? 0.35 : tc.criticality === "low" ? 0.08 : 0.14;
    const status = roll < failRate ? "failing" : roll < failRate + 0.04 ? "flaky" : "passing";
    if (status === "failing") failed++;
    else passed++;
    await db.testCase.update({ where: { id: tc.id }, data: { status, lastRunAt: now } });
    logLines.push({ timestamp: now, stream: status === "failing" ? "stderr" : "stdout", tag: status === "failing" ? "FAIL" : "TEST", message: `${tc.title} → ${status}` });

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
      title: `Manual run — ${total} cases`,
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
  return { passed, failed, total: testCases.length };
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

/** Builds exactly `count` realistic NLP steps anchored on the organisation URL. */
export function buildStepsJson(orgUrl: string, count: number, module: string, title = ""): string {
  const base = normalizeWebsite((orgUrl || "").trim()) ?? "";
  const host = base ? base.replace(/^https?:\/\//, "") : "the application";
  const goTo = base || "the application";
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
    return { id: `s${i + 1}`, action, target: action === "Navigate" && i > 0 && i % 5 === 4 ? `${base}/settings` : target, value, selector: "" };
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
