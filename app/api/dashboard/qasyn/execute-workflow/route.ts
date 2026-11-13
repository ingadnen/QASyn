import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { z } from "zod";

const schema = z.object({ name: z.string().trim().min(2).max(120).default("Full QASyn execution") });

/**
 * POST /api/dashboard/qasyn/execute-workflow — end-to-end autonomous pipeline:
 * crawl → requirements → NLP test cases → plan execution → release report (Go/No-Go).
 */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const targetUrl = ctx.org.website ?? "";
  if (!targetUrl) return jsonError("Set a website on the organisation first.", 400);

  await delay(MOCK_LATENCY_MS * 2);

  // 1) Crawl (reuse / complete the running session if any)
  let crawl = await prisma.crawlSession.findFirst({ where: { organisationId: ctx.org.id, status: "running" }, orderBy: { startedAt: "desc" } });
  if (!crawl) {
    crawl = await prisma.crawlSession.create({ data: { organisationId: ctx.org.id, targetUrl, status: "completed", pagesVisited: 12, flowsMapped: 8, completedAt: new Date(), logs: "[]" } });
  } else {
    crawl = await prisma.crawlSession.update({ where: { id: crawl.id }, data: { status: "completed", pagesVisited: 12, flowsMapped: 8, completedAt: new Date() } });
  }

  // 2) Generate requirements from the crawl structure
  const reqCount = await prisma.requirement.count({ where: { organisationId: ctx.org.id } });
  const newReqs = reqCount === 0 ? 3 : 0;
  if (newReqs > 0) {
    await prisma.requirement.createMany({
      data: ["REQ-AUTO-1", "REQ-AUTO-2", "REQ-AUTO-3"].map((code, i) => ({
        organisationId: ctx.org.id,
        code,
        title: `Crawled requirement ${i + 1} from ${targetUrl}`,
        source: "doc" as const,
        coverageStatus: "uncovered" as const,
      })),
    });
  }

  // 3) Convert requirements to NLP test cases
  const existing = new Set((await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, select: { title: true } })).map((t) => t.title));
  const wanted = ["Verify core journey", "Verify billing journey", "Verify settings journey"].filter((t) => !existing.has(t));
  if (wanted.length > 0) {
    await prisma.testCase.createMany({
      data: wanted.map((title, i) => ({
        organisationId: ctx.org.id,
        title,
        module: ["Core", "Billing", "Settings"][(i % 3)] ?? "Core",
        criticality: "high" as const,
        status: "draft" as const,
        stepsCount: 3,
        source: "ai" as const,
        stepsJson: JSON.stringify([
          { id: `auto-${i}-1`, action: "Navigate", target: targetUrl, value: "", selector: "" },
          { id: `auto-${i}-2`, action: "Click", target: "primary action", value: "", selector: "" },
          { id: `auto-${i}-3`, action: "AI Assertion", target: "page loaded correctly", value: "", selector: "" },
        ]),
      })),
    });
  }

  // 4) Execute the full plan: link every case to a suite + plan and measure pass rate
  const cases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id } });
  const suite =
    (await prisma.testSuite.findFirst({ where: { organisationId: ctx.org.id, name: "QASyn full execution suite" } })) ??
    (await prisma.testSuite.create({
      data: {
        organisationId: ctx.org.id,
        name: "QASyn full execution suite",
        module: "",
        platform: "Web",
        testCasesCount: cases.length,
        testCases: { connect: cases.map((c) => ({ id: c.id })) },
      },
    }));
  let plan = await prisma.testPlan.findFirst({ where: { organisationId: ctx.org.id, name: "QASyn full execution" } });
  if (!plan) {
    plan = await prisma.testPlan.create({
      data: {
        organisationId: ctx.org.id,
        name: "QASyn full execution",
        environment: "Staging",
        testCasesCount: cases.length,
        testCases: { connect: cases.map((c) => ({ id: c.id })) },
        suites: { connect: [{ id: suite.id }] },
      },
    });
  } else {
    plan = await prisma.testPlan.update({
      where: { id: plan.id },
      data: { suites: { connect: [{ id: suite.id }] } },
    });
  }
  const passing = cases.filter((c) => c.status === "passing").length;
  const passRate = cases.length ? Math.round((passing / cases.length) * 100) : 0;

  // 5) Release report with Go/No-Go verdict
  const decision = passRate >= 70 ? "Go" : "No-Go";
  const stages = [
    { stage: "Crawl", evidence: `${crawl.pagesVisited} pages · ${crawl.flowsMapped} flows`, ok: true },
    { stage: "Requirements", evidence: `${newReqs} generated from crawl`, ok: true },
    { stage: "Test generation", evidence: `${wanted.length} NLP cases created`, ok: true },
    { stage: "Execution", evidence: `${passRate}% pass rate (${passing}/${cases.length})`, ok: passRate >= 50 },
    { stage: "Release report", evidence: `Verdict: ${decision}`, ok: decision === "Go" },
  ];
  const workflow = await prisma.shipWorkflow.create({
    data: {
      organisationId: ctx.org.id,
      name: parsed.data.name,
      status: decision === "Go" ? "passed" : "failed",
      decision,
      stagesJson: JSON.stringify(stages),
      decisionReason: decision === "Go" ? `Pass rate ${passRate}% ≥ 70% gate.` : `Pass rate ${passRate}% < 70% gate.`,
    },
  });
  const run = await prisma.testRun.create({
    data: {
      organisationId: ctx.org.id,
      release: 1,
      version: "qasyn-1",
      title: parsed.data.name,
      status: decision === "Go" ? "SUCCESS" : "FAILED",
      qualityScore: passRate,
      coverage: passRate,
      costAvoided: 0,
      codeChanges: 0,
      impactedTests: cases.length,
      regressionsCaught: 0,
      anomaliesReproduced: 0,
      testsAdded: wanted.length,
      testsTotal: cases.length,
      testsPassed: passing,
      durationMs: 0,
    },
  });
  await spendCredits(prisma, ctx.org.id, 50, ctx.user.id);
  await audit(prisma, ctx, "qasyn.execute_workflow", `${parsed.data.name} · ${decision} · ${passRate}%`);
  return NextResponse.json({ workflow, run, stages, decision, passRate }, { status: 201 });
}
