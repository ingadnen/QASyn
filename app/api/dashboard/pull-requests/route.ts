import { NextResponse } from "next/server";
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
