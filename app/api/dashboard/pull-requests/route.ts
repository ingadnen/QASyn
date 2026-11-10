import { NextResponse } from "next/server";
import { z } from "zod";
import { CREDIT_COSTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { riskFromFiles } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { createPrSchema } from "@/lib/validation";

export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const pullRequests = await prisma.pullRequestCheck.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ pullRequests });
}

/** POST /api/dashboard/pull-requests — simulates a PR webhook; the analysis settles after a few seconds. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = createPrSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  const exists = await prisma.pullRequestCheck.findUnique({ where: { organisationId_prNumber: { organisationId: ctx.org.id, prNumber: input.prNumber } } });
  if (exists) return jsonError(`PR #${input.prNumber} has already been checked.`, 409);

  await delay(MOCK_LATENCY_MS);
  const pr = await prisma.$transaction(async (tx) => {
    const created = await tx.pullRequestCheck.create({
      data: { organisationId: ctx.org.id, ...input, status: "running", riskLevel: riskFromFiles(input.filesChanged) },
    });
    await spendCredits(tx, ctx.org.id, CREDIT_COSTS.prAnalysis);
    await audit(tx, ctx, "pull_request.checked", `#${input.prNumber} ${input.title}`);
    return created;
  });
  return NextResponse.json({ pullRequest: pr }, { status: 201 });
}

const rerunSchema = z.object({ id: z.string().min(1).max(60) });

/** PATCH /api/dashboard/pull-requests — re-runs the impact analysis for one pull request. */
export async function PATCH(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = rerunSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const pr = await prisma.pullRequestCheck.findFirst({ where: { id: parsed.data.id, organisationId: ctx.org.id } });
  if (!pr) return jsonError("Pull request not found.", 404);

  const highRisk = pr.riskLevel === "high";
  const status = highRisk ? "regression_caught" : "passed";
  const regressions = highRisk ? Math.max(pr.regressions, 1) : 0;
  const testsRun = Math.max(pr.testsRun, 6);

  await delay(MOCK_LATENCY_MS);
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.pullRequestCheck.update({
      where: { id: pr.id },
      data: { status, regressions, testsRun },
    });
    await spendCredits(tx, ctx.org.id, CREDIT_COSTS.prAnalysis);
    await audit(tx, ctx, "pull_request.reanalysed", `#${pr.prNumber} ${pr.title}`);
    return next;
  });
  return NextResponse.json({ pullRequest: updated });
}
