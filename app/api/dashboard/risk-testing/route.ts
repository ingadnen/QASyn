import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { computeRisk, prioritize } from "@/lib/risk-engine";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  branchName: z.string().trim().min(1).max(100),
  prNumber: z.number().int().min(1).nullable().optional(),
  filesChanged: z.number().int().min(0).max(5000).default(0),
  modulesTouched: z.array(z.string().max(40)).max(20).default([]),
});

/** GET /api/dashboard/risk-testing — recent risk analyses (org-scoped). */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const analyses = await prisma.riskAnalysis.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { analyzedAt: "desc" }, take: 20 });
  return NextResponse.json({ analyses });
}

/** POST /api/dashboard/risk-testing — compute risk + prioritized tests. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { branchName, prNumber, filesChanged, modulesTouched } = parsed.data;

  const cases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, title: true, status: true, criticality: true } });
  const flaky = cases.filter((c) => c.status === "flaky").length;
  const failing = cases.filter((c) => c.status === "failing").length;
  const coverageGap = cases.length ? 100 - Math.round((cases.filter((c) => c.status === "passing").length / cases.length) * 100) : 100;
  const risk = computeRisk({ filesChanged, modulesTouched, flakyCases: flaky, failingCases: failing, coverageGap });
  const prioritized = prioritize(cases);

  const analysis = await prisma.riskAnalysis.create({
    data: {
      organisationId: ctx.org.id,
      branchName,
      prNumber: prNumber ?? null,
      riskScore: risk.score,
      riskLevel: risk.level,
      factorsJson: JSON.stringify(risk.factors),
      suggestedTests: JSON.stringify(prioritized.slice(0, 10).map((p) => p.id)),
    },
  });
  await audit(prisma, ctx, "risk.analyzed", `${branchName} · score ${risk.score} (${risk.level})`);
  return NextResponse.json({ analysis, risk, prioritized }, { status: 201 });
}
