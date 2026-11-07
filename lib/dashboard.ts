import type { LogLine, TestRun } from "@prisma/client";
import { prisma } from "./db";
import type { CrawlLogLine, IntegrationStatus, LogDTO, LogStream, LogTag, Provider, RunDTO, RunStatus } from "./types";

export function serializeRun(run: TestRun): RunDTO {
  return {
    id: run.id,
    release: run.release,
    version: run.version,
    title: run.title,
    branch: run.branch,
    prNumber: run.prNumber,
    status: run.status as RunStatus,
    qualityScore: run.qualityScore,
    coverage: run.coverage,
    costAvoided: run.costAvoided,
    regressionsCaught: run.regressionsCaught,
    testsTotal: run.testsTotal,
    testsPassed: run.testsPassed,
    createdAt: run.createdAt.toISOString(),
  };
}

export function serializeLog(line: LogLine): LogDTO {
  return {
    id: line.id,
    timestamp: line.timestamp.toISOString(),
    stream: line.stream as LogStream,
    tag: line.tag as LogTag,
    message: line.message,
  };
}

export function parseCrawlLogs(json: string): CrawlLogLine[] {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? (value as CrawlLogLine[]) : [];
  } catch {
    return [];
  }
}

export const BUG_SAVING_USD = 1250;
export const REGRESSION_SAVING_USD = 2400;

export interface ModuleCoverage {
  name: string;
  total: number;
  passing: number;
  failing: number;
  coverage: number;
}

function coverageRows(rows: Array<{ key: string; status: string; count: number }>): ModuleCoverage[] {
  const map = new Map<string, ModuleCoverage>();
  for (const r of rows) {
    const m = map.get(r.key) ?? { name: r.key, total: 0, passing: 0, failing: 0, coverage: 0 };
    m.total += r.count;
    if (r.status === "passing") m.passing += r.count;
    if (r.status === "failing") m.failing += r.count;
    map.set(r.key, m);
  }
  return [...map.values()]
    .map((m) => ({ ...m, coverage: m.total ? Math.round((m.passing / m.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Every Overview metric for ONE organisation (always scoped by organisationId). */
export async function getOverview(organisationId: string) {
  const where = { organisationId };
  const [byModule, byCriticality, bugs, reproduced, runsAgg, prs, prRegressions, integrations, crawl, recents, latestRun] =
    await Promise.all([
      prisma.testCase.groupBy({ by: ["module", "status"], where, _count: { _all: true } }),
      prisma.testCase.groupBy({ by: ["criticality", "status"], where, _count: { _all: true } }),
      prisma.bugReport.count({ where }),
      prisma.bugReport.count({ where: { ...where, status: "reproduced" } }),
      prisma.testRun.aggregate({ where, _sum: { costAvoided: true, regressionsCaught: true } }),
      prisma.pullRequestCheck.count({ where }),
      prisma.pullRequestCheck.aggregate({ where: { ...where, status: "regression_caught" }, _sum: { regressions: true } }),
      prisma.integration.findMany({ where, orderBy: { connectedAt: "asc" } }),
      prisma.crawlSession.findFirst({ where, orderBy: { startedAt: "desc" } }),
      prisma.systemAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.testRun.findFirst({ where, orderBy: { createdAt: "desc" }, include: { logs: { orderBy: { timestamp: "asc" } } } }),
    ]);

  const modules = coverageRows(byModule.map((r) => ({ key: r.module, status: r.status, count: r._count._all })));
  const criticality = coverageRows(byCriticality.map((r) => ({ key: r.criticality, status: r.status, count: r._count._all })));
  const tests = modules.reduce(
    (acc, m) => ({ total: acc.total + m.total, passing: acc.passing + m.passing, failing: acc.failing + m.failing }),
    { total: 0, passing: 0, failing: 0 },
  );
  const regressions = (runsAgg._sum.regressionsCaught ?? 0) + (prRegressions._sum.regressions ?? 0);
  const saved =
    (runsAgg._sum.costAvoided ?? 0) + reproduced * BUG_SAVING_USD + (prRegressions._sum.regressions ?? 0) * REGRESSION_SAVING_USD;

  return {
    tests,
    bugs: { total: bugs, reproduced },
    saved,
    hoursSaved: Math.round(saved / 95),
    regressions,
    prsChecked: prs,
    leadTimeHours: prs > 0 ? Math.max(0.6, 6.5 - Math.min(prs, 20) * 0.25) : null,
    integrations: integrations.map((i) => ({ provider: i.provider as Provider, status: i.status as IntegrationStatus, detail: i.detail })),
    modules,
    criticality,
    crawl,
    recents: recents.map((r) => ({ id: r.id, actorEmail: r.actorEmail, action: r.action, target: r.target, createdAt: r.createdAt.toISOString() })),
    latestRun: latestRun ? { run: serializeRun(latestRun), logs: latestRun.logs.map(serializeLog) } : null,
  };
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;
