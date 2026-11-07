import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { flakinessIndex } from "@/lib/report-generator";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await requireOrgContext();
  const [runs, cases] = await Promise.all([
    prisma.testRun.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" }, take: 60 }),
    prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, take: 100, select: { title: true, module: true, status: true } }),
  ]);
  const maxPass = 100;
  const avg = runs.length ? Math.round((runs.reduce((s, r) => s + (r.testsTotal ? (r.testsPassed / r.testsTotal) * 100 : 0), 0) / runs.length) * 10) / 10 : 0;
  const flaky = cases.filter((c) => c.status === "flaky").length;
  const modules = [...new Set(cases.map((c) => c.module))];
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="ANALYTICS"
        title="Reports"
        description={`Pass-rate trend over ${runs.length} runs · average ${avg}% · ${flaky} flaky cases.`}
        actions={
          <a href="/api/dashboard/reports?format=csv" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            Export CSV
          </a>
        }
      />
      <Card title="Pass rate trend (last runs)">
        {runs.length === 0 ? <EmptyState title="No runs" description="Run a test plan to generate trends." /> : (
          <div className="flex h-40 items-end gap-1 px-5 py-4">
            {runs.map((r) => {
              const rate = r.testsTotal ? (r.testsPassed / r.testsTotal) * 100 : 0;
              return (
                <div key={r.id} className="group relative flex-1" title={`Release #${r.release}: ${Math.round(rate)}%`}>
                  <div className={`w-full rounded-t ${rate >= 70 ? "bg-emerald-500" : "bg-red-400"}`} style={{ height: `${Math.max(4, (rate / maxPass) * 100)}%` }} />
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Module coverage">
          {modules.length === 0 ? <EmptyState title="No modules" description="Create test cases first." /> : (
            <ul className="px-5 py-3">
              {modules.map((m) => {
                const inModule = cases.filter((c) => c.module === m);
                const passing = inModule.filter((c) => c.status === "passing").length;
                const pct = inModule.length ? Math.round((passing / inModule.length) * 100) : 0;
                return (
                  <li key={m} className="py-1.5">
                    <div className="flex justify-between text-sm"><span className="font-medium">{m}</span><span className="text-slate-500">{passing}/{inModule.length} · {pct}%</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Flakiness index">
          <ul className="px-5 py-3">
            {cases.slice(0, 10).map((c) => {
              const score = flakinessIndex([c.status, c.status, c.status]);
              return (
                <li key={c.title} className="flex justify-between py-1 text-sm"><span className="truncate">{c.title}</span><span className={score > 0 ? "font-semibold text-amber-600" : "text-slate-500"}>{score}%</span></li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
