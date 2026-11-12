import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { analyzePrImpact } from "@/lib/engines";
import { analyzeBlastRadius } from "@/lib/qasyn-engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { prImpactSchema } from "@/lib/validation";

/** POST /api/dashboard/qasyn/pr-impact — map changed files, select the regression scope, decide Go/No-Go. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = prImpactSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { prNumber, branch, title, files } = parsed.data;

  await delay(MOCK_LATENCY_MS * 2);
  const testCases = await prisma.testCase.findMany({
    where: { organisationId: ctx.org.id },
    select: { id: true, title: true, module: true, status: true },
  });
  const impact = analyzePrImpact(files, testCases);
  const blastRadius = analyzeBlastRadius(files, testCases);
  const analysis = await prisma.prAnalysis.create({
    data: {
      organisationId: ctx.org.id,
      prNumber,
      branch,
      title,
      filesChangedJson: JSON.stringify(files),
      scopeJson: JSON.stringify(impact.scopeTestCaseIds),
      riskLevel: impact.riskLevel,
      decision: impact.decision,
      impactAssessment: JSON.stringify(impact.assessment),
    },
  });
  await prisma.pullRequestCheck.upsert({
    where: { organisationId_prNumber: { organisationId: ctx.org.id, prNumber } },
    create: {
      organisationId: ctx.org.id,
      prNumber,
      title,
      branch,
      author: ctx.user.name,
      status: impact.decision === "Go" ? "passed_baseline" : "regression_caught",
      riskLevel: impact.riskLevel,
      filesChanged: files.length,
      testsRun: impact.scopeTestCaseIds.length,
      regressions: impact.decision === "No-Go" ? 1 : 0,
    },
    update: {
      title,
      branch,
      status: impact.decision === "Go" ? "passed_baseline" : "regression_caught",
      riskLevel: impact.riskLevel,
      filesChanged: files.length,
      testsRun: impact.scopeTestCaseIds.length,
      regressions: impact.decision === "No-Go" ? 1 : 0,
    },
  });
  await spendCredits(prisma, ctx.org.id, 10);
  await audit(prisma, ctx, "qasyn.pr_impact", `#${prNumber} ${title} · ${impact.riskLevel} · ${impact.decision}`);
  return NextResponse.json({ analysis, impact, blastRadius });
}

/** GET /api/dashboard/qasyn/pr-impact — recent PR analyses of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const analyses = await prisma.prAnalysis.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ analyses });
}
