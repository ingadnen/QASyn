import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { z } from "zod";

const schema = z.object({ name: z.string().trim().min(2).max(120).default("Autonomous QASyn run") });

/** GET /api/dashboard/qasyn/workflows — autonomous workflow history. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const workflows = await prisma.shipWorkflow.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ workflows });
}

/** POST /api/dashboard/qasyn/workflows — run the autonomous pipeline (crawl → generate → execute → report). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const tests = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, select: { status: true } });
  if (tests.length === 0) return jsonError("Run a crawl or create test cases first.", 400);

  await delay(MOCK_LATENCY_MS * 2);
  const passing = tests.filter((t) => t.status === "passing").length;
  const passRate = Math.round((passing / tests.length) * 100);
  const decision = passRate >= 70 ? "Go" : "No-Go";
  const stages = [
    { stage: "Crawl", evidence: `${ctx.org.website ?? "no website"} mapped`, ok: true },
    { stage: "Generate", evidence: `${tests.length} test cases in scope`, ok: true },
    { stage: "Execute", evidence: `${passRate}% pass rate (${passing}/${tests.length})`, ok: passRate >= 50 },
    { stage: "Report", evidence: `${passRate >= 70 ? "quality gate met" : "quality gate missed"}`, ok: decision === "Go" },
  ];
  const workflow = await prisma.shipWorkflow.create({
    data: {
      organisationId: ctx.org.id,
      name: parsed.data.name,
      status: decision === "Go" ? "passed" : "failed",
      decision,
      stagesJson: JSON.stringify(stages),
      decisionReason: decision === "Go" ? `Pass rate ${passRate}% ≥ 70% gate.` : `Pass rate ${passRate}% < 70% gate — investigate failing cases.`,
    },
  });
  await spendCredits(prisma, ctx.org.id, 20);
  await audit(prisma, ctx, "qasyn.workflow", `${workflow.name} · ${decision}`);
  return NextResponse.json({ workflow, stages }, { status: 201 });
}
