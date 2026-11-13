import { NextResponse } from "next/server";
import { CREDIT_COSTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS } from "@/lib/http";
import { audit, guardApi, spendCredits, writeSettings } from "@/lib/tenant";
import { delay } from "@/lib/utils";

/** POST /api/dashboard/code-analysis — re-runs the (simulated) static analysis of connected repositories. */
export async function POST() {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const repo = await prisma.integration.findFirst({
    where: { organisationId: ctx.org.id, provider: { in: ["GITHUB", "GITLAB"] }, status: "CONNECTED" },
  });
  if (!repo) return jsonError("Connect GitHub or GitLab first.", 409);
  await delay(MOCK_LATENCY_MS * 2);
  const at = new Date().toISOString();
  await writeSettings(prisma, ctx.org, { codeAnalysisAt: at });
  await spendCredits(prisma, ctx.org.id, CREDIT_COSTS.codeAnalysis, ctx.user.id);
  await audit(prisma, ctx, "code_analysis.run", repo.detail ?? repo.provider);
  return NextResponse.json({ analysedAt: at });
}
