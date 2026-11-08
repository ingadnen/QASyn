import type { CrawlSession, Prisma, PrismaClient, TestCase } from "@prisma/client";
import { CREDIT_COSTS } from "./constants";
import { buildCrawlLogs, crawlPlan, crawlProgress, hostFromUrl } from "./crawl";
import { prisma } from "./db";
import { audit, spendCredits, type OrgContext } from "./tenant";

/**
 * Simulated AQE engine. Everything is local: no request ever leaves the server
 * (crawls, PR analyses and test runs are derived from the organisation's own data).
 */

type Db = PrismaClient | Prisma.TransactionClient;
type Actor = Pick<OrgContext, "org" | "user">;

const PENDING_MS = 6000;

export async function startCrawl(db: Db, actor: Actor, targetUrl: string, opts?: { platform?: string; publishMode?: string; testTypes?: string[]; prerequisites?: string[] }): Promise<CrawlSession> {
  const running = await db.crawlSession.findFirst({ where: { organisationId: actor.org.id, status: "running" } });
  if (running) return running;
  const crawl = await db.crawlSession.create({
    data: {
      organisationId: actor.org.id,
      targetUrl,
      status: "running",
      logs: JSON.stringify(buildCrawlLogs(targetUrl)),
      publishMode: opts?.publishMode ?? "Require approval",
      testTypesJson: JSON.stringify(opts?.testTypes ?? []),
      prerequisitesJson: JSON.stringify(opts?.prerequisites ?? []),
    },
  });
  // Auto-create the associated requirement (REQ-00X <date>_crawl)
  const count = await db.requirement.count({ where: { organisationId: actor.org.id } });
  const code = `REQ-${String(count + 1).padStart(3, "0")}`;
  const requirement = await db.requirement
    .create({ data: { organisationId: actor.org.id, code, title: `${new Date().toISOString().slice(0, 10)}_crawl — ${hostFromUrl(targetUrl)}`, source: "doc", coverageStatus: "uncovered" } })
    .catch(() => null);
  if (requirement) {
    await db.crawlSession.update({ where: { id: crawl.id }, data: { requirementId: requirement.id } });
  }
  await spendCredits(db, actor.org.id, CREDIT_COSTS.crawl);
  await audit(db, actor, "crawl.started", hostFromUrl(targetUrl));
  return crawl;
}

/** "Complete Crawl Now": finishes the crawl and turns mapped flows into the first test cases. */
export async function completeCrawl(db: Db, actor: Actor, crawl: CrawlSession) {
  if (crawl.status !== "running") return { created: 0 };
  const { pages, flows, host } = crawlPlan(crawl.targetUrl);

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
          stepsCount: flow.steps,
          source: "crawl",
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
  // Auto Publish: create TestSuite + TestPlan so generated cases are immediately runnable.
  if (crawl.publishMode === "Auto publish" && fresh.length > 0) {
    const created = await db.testCase.findMany({ where: { organisationId: actor.org.id, title: { in: fresh.map((c) => c.name) } } });
    const suite = await db.testSuite.create({
      data: { organisationId: actor.org.id, name: `${host} crawl suite`, description: `Generated from crawl ${crawl.targetUrl}`, testCasesCount: fresh.length, passRate: 0 },
    });
    const plan = await db.testPlan.create({
      data: { organisationId: actor.org.id, name: `${host} crawl plan`, environment: "Staging", testCasesCount: fresh.length, passRate: 0, testCases: { connect: created.map((c) => ({ id: c.id })) } },
    });
    await audit(db, actor, "crawl.suite_created", `${suite.name} · ${fresh.length} cases`);
    await audit(db, actor, "crawl.plan_created", plan.name);
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

export function generateTitles(module: string, prompt: string, count: number): string[] {
  const base = AI_TEMPLATES[module] ?? [`Open the ${module} page`, `Create a ${module} item`, `Edit a ${module} item`, `Delete a ${module} item`];
  const focus = prompt.trim().replace(/\s+/g, " ").slice(0, 60);
  const titles = base.map((t) => (focus ? `${t} — ${focus}` : t));
  return titles.slice(0, Math.max(1, Math.min(count, titles.length)));
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
