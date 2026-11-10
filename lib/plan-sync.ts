import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Portfolio consistency for suites and plans.
 *
 * Seeded and crawled suites used to store a `testCasesCount` without any real
 * relation, so the UI showed "14 cases" over an empty table. These helpers
 * derive the target cases from the suite semantics (module, crawl source or
 * "Smoke" = every organisation case), persist the relation and the true count,
 * then link the suites to their plans (one source of truth for "Suites in plan").
 */

type SuiteShape = {
  id: string;
  name: string;
  description: string | null;
  module: string;
  testCasesCount: number;
  testCases: Array<{ id: string }>;
};

type CaseShape = { id: string; module: string; source: string; status: string };

function isSmokeSuite(suite: { name: string; description: string | null; module: string }) {
  return suite.module === "" && /smoke|critical path|sign-off|release/i.test(`${suite.name} ${suite.description ?? ""}`);
}

/** Cases a suite should contain, or null when its links are user-managed. */
function targetCasesForSuite(suite: SuiteShape, cases: CaseShape[]): CaseShape[] | null {
  if (/crawl/i.test(suite.name) || /generated from crawl/i.test(suite.description ?? "")) {
    return cases.filter((testCase) => testCase.source === "crawl");
  }
  if (suite.module.trim()) {
    return cases.filter((testCase) => testCase.module.toLowerCase() === suite.module.trim().toLowerCase());
  }
  if (isSmokeSuite(suite)) return cases;
  return null;
}

export async function syncSuiteLinks(db: Db, organisationId: string, suiteId?: string) {
  const [suites, cases] = await Promise.all([
    db.testSuite.findMany({
      where: { organisationId, ...(suiteId ? { id: suiteId } : {}) },
      select: {
        id: true,
        name: true,
        description: true,
        module: true,
        testCasesCount: true,
        testCases: { select: { id: true } },
      },
    }),
    db.testCase.findMany({ where: { organisationId }, select: { id: true, module: true, source: true, status: true } }),
  ]);

  for (const suite of suites) {
    const target = targetCasesForSuite(suite, cases);
    if (!target) {
      // Keep user-managed links but make the stored count truthful.
      if (suite.testCasesCount !== suite.testCases.length) {
        await db.testSuite.update({ where: { id: suite.id }, data: { testCasesCount: suite.testCases.length } });
      }
      continue;
    }

    const current = new Set(suite.testCases.map((testCase) => testCase.id));
    const sameSet = current.size === target.length && target.every((testCase) => current.has(testCase.id));
    if (sameSet && suite.testCasesCount === target.length) continue;

    const passing = target.filter((testCase) => testCase.status === "passing").length;
    await db.testSuite.update({
      where: { id: suite.id },
      data: {
        testCases: { set: target.map((testCase) => ({ id: testCase.id })) },
        testCasesCount: target.length,
        passRate: target.length ? Math.round((passing / target.length) * 100) : 0,
      },
    });
  }
}

/** Ensures a plan links its suites and that the case count includes suite cases. */
export async function syncPlanLinks(db: Db, organisationId: string, planId?: string) {
  const [plans, suites, cases] = await Promise.all([
    db.testPlan.findMany({
      where: { organisationId, ...(planId ? { id: planId } : {}) },
      select: {
        id: true,
        name: true,
        description: true,
        module: true,
        testCasesCount: true,
        suites: { select: { id: true } },
        testCases: { select: { id: true } },
      },
    }),
    db.testSuite.findMany({ where: { organisationId }, select: { id: true, name: true, module: true } }),
    db.testCase.findMany({ where: { organisationId }, select: { id: true, module: true, source: true, status: true } }),
  ]);

  for (const plan of plans) {
    const label = `${plan.name} ${plan.description ?? ""}`.toLowerCase();
    const fullPortfolio = !plan.module.trim() && /release|full regression|sign-off|smoke|critical path/.test(label);
    const targetSuiteIds = new Set(plan.suites.map((suite) => suite.id));

    if (plan.suites.length === 0) {
      if (fullPortfolio) {
        for (const suite of suites) targetSuiteIds.add(suite.id);
      } else if (plan.module.trim()) {
        for (const suite of suites) {
          if (suite.module.toLowerCase() === plan.module.trim().toLowerCase()) targetSuiteIds.add(suite.id);
        }
      }
    }

    // Cases = directly linked cases ∪ every case of the linked suites.
    const suiteCaseIds = new Set(plan.testCases.map((testCase) => testCase.id));
    if (targetSuiteIds.size > 0) {
      const suiteCases = await db.testCase.findMany({
        where: { organisationId, testSuites: { some: { id: { in: [...targetSuiteIds] } } } },
        select: { id: true },
      });
      for (const testCase of suiteCases) suiteCaseIds.add(testCase.id);
    }

    // Plans with no suite and no direct case fall back to module / portfolio scope.
    if (suiteCaseIds.size === 0) {
      const fallback = fullPortfolio
        ? cases
        : plan.module.trim()
          ? cases.filter((testCase) => testCase.module.toLowerCase() === plan.module.trim().toLowerCase())
          : [];
      for (const testCase of fallback) suiteCaseIds.add(testCase.id);
    }

    const targetCases = cases.filter((testCase) => suiteCaseIds.has(testCase.id));
    const currentSuites = new Set(plan.suites.map((suite) => suite.id));
    const sameSuites = currentSuites.size === targetSuiteIds.size && [...targetSuiteIds].every((id) => currentSuites.has(id));
    const currentCases = new Set(plan.testCases.map((testCase) => testCase.id));
    const sameCases = currentCases.size === targetCases.length && targetCases.every((testCase) => currentCases.has(testCase.id));
    if (sameSuites && sameCases && plan.testCasesCount === targetCases.length) continue;

    const passing = targetCases.filter((testCase) => testCase.status === "passing").length;
    await db.testPlan.update({
      where: { id: plan.id },
      data: {
        ...(sameSuites ? {} : { suites: { set: [...targetSuiteIds].map((id) => ({ id })) } }),
        ...(sameCases ? {} : { testCases: { set: targetCases.map((testCase) => ({ id: testCase.id })) } }),
        testCasesCount: targetCases.length,
        passRate: targetCases.length ? Math.round((passing / targetCases.length) * 100) : 0,
      },
    });
  }
}

/** Runs both repair passes (cheap when everything is already consistent). */
export async function syncPortfolio(db: Db, organisationId: string) {
  await syncSuiteLinks(db, organisationId);
  await syncPlanLinks(db, organisationId);
}
