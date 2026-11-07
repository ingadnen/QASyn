import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { simulateVitals } from "@/lib/performance-metrics";
import { guardApi } from "@/lib/tenant";

/** GET /api/dashboard/performance — Web Vitals for recent runs (org-scoped). */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const runs = await prisma.testRun.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, take: 10 });
  const metrics = [];
  for (const run of runs) {
    const stored = await prisma.performanceMetric.findMany({ where: { testRunId: run.id }, orderBy: { metric: "asc" } });
    if (stored.length === 0) {
      const vitals = simulateVitals(run.id);
      for (const v of vitals) {
        const row = await prisma.performanceMetric.create({ data: { testRunId: run.id, metric: v.metric, value: v.value, threshold: v.threshold, passed: v.passed } });
        metrics.push({ run: run.id, ...row });
      }
    } else {
      metrics.push(...stored.map((m) => ({ run: run.id, ...m })));
    }
  }
  return NextResponse.json({ runs: runs.map((r) => ({ id: r.id, release: r.release, date: r.createdAt })), metrics });
}
