import { prisma } from "./db";

export const MCP_TOOLS = [
  { name: "list_test_cases", description: "Test cases with module, criticality and status." },
  { name: "get_quality_summary", description: "Coverage, regressions, bugs and cost avoided." },
  { name: "list_bugs", description: "Latest reproduced bugs with root cause." },
  { name: "list_pull_requests", description: "Pull request verdicts and risk level." },
] as const;

export type McpToolName = (typeof MCP_TOOLS)[number]["name"];

/** Executes an MCP tool for ONE organisation (always scoped by organisationId, read-only). */
export async function runMcpTool(organisationId: string, tool: McpToolName) {
  const where = { organisationId };
  switch (tool) {
    case "list_test_cases":
      return prisma.testCase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, title: true, module: true, criticality: true, status: true, lastRunAt: true },
      });
    case "list_bugs":
      return prisma.bugReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, title: true, severity: true, status: true, rootCause: true, createdAt: true },
      });
    case "list_pull_requests":
      return prisma.pullRequestCheck.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { prNumber: true, title: true, status: true, riskLevel: true, regressions: true, testsRun: true },
      });
    case "get_quality_summary": {
      const [tests, passing, bugs, runs] = await Promise.all([
        prisma.testCase.count({ where }),
        prisma.testCase.count({ where: { ...where, status: "passing" } }),
        prisma.bugReport.count({ where: { ...where, status: "reproduced" } }),
        prisma.testRun.aggregate({ where, _sum: { costAvoided: true, regressionsCaught: true }, _avg: { qualityScore: true } }),
      ]);
      return {
        testCases: tests,
        passRate: tests ? Math.round((passing / tests) * 100) : 0,
        bugsReproduced: bugs,
        regressionsCaught: runs._sum.regressionsCaught ?? 0,
        costAvoidedUsd: Math.round(runs._sum.costAvoided ?? 0),
        averageQualityScore: runs._avg.qualityScore === null ? null : Math.round(runs._avg.qualityScore),
      };
    }
  }
}
