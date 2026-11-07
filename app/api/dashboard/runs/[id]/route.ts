import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { guardApi } from "@/lib/tenant";

/** GET /api/dashboard/runs/[id] — full execution evidence detail (org-scoped). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const { id } = await params;
  const run = await prisma.testRun.findFirst({ where: { id, organisationId: guard.ctx.org.id }, include: { logs: { orderBy: { timestamp: "asc" } } } });
  if (!run) return jsonError("Run not found.", 404);
  const metrics = await prisma.performanceMetric.findMany({ where: { testRunId: run.id }, orderBy: { metric: "asc" } });
  let evidence: unknown = [];
  try {
    evidence = JSON.parse(run.evidenceJson || "[]");
  } catch {
    evidence = [];
  }
  let logsJson: unknown = [];
  try {
    logsJson = JSON.parse(run.logsJson || "[]");
  } catch {
    logsJson = [];
  }
  return NextResponse.json({ run, logs: run.logs, metrics, evidence, logsJson });
}
