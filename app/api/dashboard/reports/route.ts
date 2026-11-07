import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { summaryStats, toCsv } from "@/lib/report-generator";
import { guardApi } from "@/lib/tenant";

/** GET /api/dashboard/reports?from=&to=&format=csv — trends + CSV export (org-scoped). */
export async function GET(request: Request) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const format = url.searchParams.get("format");

  const runs = await prisma.testRun.findMany({
    where: {
      organisationId: guard.ctx.org.id,
      ...(from ? { createdAt: { gte: new Date(from) } } : {}),
      ...(to ? { createdAt: { lte: new Date(to) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const rows = runs.map((r) => ({
    release: r.release,
    version: r.version,
    date: r.createdAt.toISOString(),
    status: r.status,
    passRate: r.testsTotal ? Math.round((r.testsPassed / r.testsTotal) * 100) : 0,
    tests: r.testsTotal,
    passed: r.testsPassed,
  }));
  const stats = summaryStats(rows);
  if (format === "csv") {
    return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=qasyn-report.csv" } });
  }
  const cases = await prisma.testCase.findMany({ where: { organisationId: guard.ctx.org.id }, select: { title: true, module: true, status: true, criticality: true } });
  return NextResponse.json({ rows, stats, cases });
}
