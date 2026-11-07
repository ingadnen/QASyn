import type { Metadata } from "next";
import { PlanRunButton } from "@/components/dashboard/pages/EnginesClient";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Web testing" };
export const dynamic = "force-dynamic";

export default async function WebTestingPage() {
  const ctx = await requireOrgContext();
  const [suites, plans, envs, runs] = await Promise.all([
    prisma.testSuite.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, include: { testCases: { select: { id: true } } } }),
    prisma.testPlan.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, include: { testCases: { select: { id: true } } } }),
    prisma.environmentConfig.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" } }),
    prisma.testRun.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader kicker="WEB TESTING ENGINE" title="Web testing" description="Suites, plan orchestration across environments and browsers, and the full execution history." />
      <Card title="Test suites">
        {suites.length === 0 ? <EmptyState title="No suites" description="Create one under Test suites." /> : (
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {suites.map((s) => (
              <li key={s.id} className="py-2 text-sm">
                <span className="font-medium text-slate-800">{s.name}</span>{" "}
                <span className="text-xs text-slate-500">{s.testCases.length} linked cases · {s.schedule}{s.module ? ` · ${s.module}` : ""} · {Math.round(s.passRate)}% pass</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Plan orchestration (Run executes every case with AI auto-healing)">
        {plans.length === 0 ? <EmptyState title="No plans" description="Create one under Test plans, link test cases, then run it here." /> : (
          <ul className="divide-y divide-slate-100">
            {plans.map((p) => {
              const browsers: string[] = JSON.parse(p.browsersJson || '["Chromium"]');
              return (
                <li key={p.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.environment ?? "No environment"} · browsers: {browsers.join(", ")} · {p.testCases.length} cases · {Math.round(p.passRate)}% pass
                        {p.lastRunAt ? ` · last run ${timeAgo(p.lastRunAt)}` : ""}
                      </p>
                    </div>
                    <PlanRunButton planId={p.id} readOnly={ctx.readOnly} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Environments">
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {envs.length === 0 && <li className="py-3 text-sm text-slate-500">No environments yet.</li>}
            {envs.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-medium">{e.name}</span>
                <span className="truncate text-xs text-slate-500">{e.baseUrl}</span>
                {e.isDefault && <StatusPill value="active" label="default" />}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Execution history">
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {runs.length === 0 && <li className="py-3 text-sm text-slate-500">No runs yet.</li>}
            {runs.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <span className="font-medium">Release #{r.release}</span> <span className="text-xs text-slate-500">v{r.version} · {r.testsPassed}/{r.testsTotal} passed · {r.durationMs} ms · {timeAgo(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
