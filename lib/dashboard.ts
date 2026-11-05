import type { LogLine, Organisation, TestRun } from "@prisma/client";
import { prisma } from "./db";
import { getCurrentOrgId } from "./session";
import type { LogDTO, LogStream, LogTag, RunDTO, RunStatus } from "./types";

export const DEMO_ORG_SLUG = "acme";

export interface DashboardContext {
  org: Organisation;
  /** true si on affiche l'organisation de démonstration (seed) */
  isDemo: boolean;
  /** Organisation de la session dont l'onboarding n'est pas terminé */
  pendingOrg: Organisation | null;
}

/**
 * Détermine l'organisation à afficher : celle de la session si elle a des runs,
 * sinon l'organisation de démonstration "acme" (seed).
 */
export async function resolveDashboardOrg(): Promise<DashboardContext | null> {
  const organisationId = await getCurrentOrgId();
  let pendingOrg: Organisation | null = null;

  if (organisationId) {
    const org = await prisma.organisation.findUnique({ where: { id: organisationId } });
    if (org) {
      const runs = await prisma.testRun.count({ where: { organisationId: org.id } });
      if (runs > 0) return { org, isDemo: false, pendingOrg: null };
      pendingOrg = org;
    }
  }

  const demo = await prisma.organisation.findUnique({ where: { slug: DEMO_ORG_SLUG } });
  return demo ? { org: demo, isDemo: true, pendingOrg } : null;
}

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
    codeChanges: run.codeChanges,
    impactedTests: run.impactedTests,
    regressionsCaught: run.regressionsCaught,
    anomaliesReproduced: run.anomaliesReproduced,
    testsAdded: run.testsAdded,
    testsTotal: run.testsTotal,
    testsPassed: run.testsPassed,
    durationMs: run.durationMs,
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

/** Toutes les données du tableau de bord, lues depuis SQLite. */
export async function getOverview(organisationId: string) {
  const [runs, totals] = await Promise.all([
    prisma.testRun.findMany({ where: { organisationId }, orderBy: { createdAt: "asc" } }),
    prisma.testRun.aggregate({
      where: { organisationId },
      _count: { _all: true },
      _avg: { coverage: true, qualityScore: true },
      _sum: {
        costAvoided: true,
        regressionsCaught: true,
        anomaliesReproduced: true,
        testsAdded: true,
        testsTotal: true,
        testsPassed: true,
      },
    }),
  ]);

  const latest = runs.at(-1) ?? null;
  const logs = latest
    ? await prisma.logLine.findMany({ where: { testRunId: latest.id }, orderBy: { timestamp: "asc" } })
    : [];

  const testsTotal = totals._sum.testsTotal ?? 0;
  return {
    runs: runs.map(serializeRun),
    latestLogs: logs.map(serializeLog),
    totals: {
      runs: totals._count._all,
      failedRuns: runs.filter((r) => r.status === "FAILED").length,
      avgCoverage: totals._avg.coverage ?? 0,
      avgQualityScore: totals._avg.qualityScore ?? 0,
      costAvoided: totals._sum.costAvoided ?? 0,
      regressionsCaught: totals._sum.regressionsCaught ?? 0,
      anomaliesReproduced: totals._sum.anomaliesReproduced ?? 0,
      testsAdded: totals._sum.testsAdded ?? 0,
      passRate: testsTotal > 0 ? ((totals._sum.testsPassed ?? 0) / testsTotal) * 100 : 0,
    },
  };
}
