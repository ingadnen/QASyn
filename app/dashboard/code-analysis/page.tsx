import type { Metadata } from "next";
import { CodeAnalysisRun } from "@/components/dashboard/pages/Forms";
import { Card, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Code analysis" };
export const dynamic = "force-dynamic";

export default async function CodeAnalysisPage() {
  const ctx = await requireOrgContext();
  const repos = await prisma.integration.findMany({ where: { organisationId: ctx.org.id, provider: { in: ["GITHUB", "GITLAB"] } } });
  const settings = readSettings(ctx.org);
  const hasRepo = repos.some((r) => r.status === "CONNECTED");
  const testCases = await prisma.testCase.groupBy({ by: ["module"], where: { organisationId: ctx.org.id }, _count: { _all: true } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="AUTONOMOUS SDLC" title="Code analysis" description="Static analysis of connected repositories: risk zones, coverage gaps and impacted tests." />
      <Card title="Connected repositories">
        <div className="px-5 py-4">
          {repos.length === 0 ? <p className="text-sm text-slate-500">No repository connected. Connect GitHub or GitLab in Integrations.</p> : (
            <ul className="space-y-2">{repos.map((r) => <li key={r.id} className="flex items-center gap-3 text-sm"><span className="font-medium capitalize">{r.provider.toLowerCase()}</span><span className="text-slate-500">{r.detail}</span><StatusPill value={r.status} /></li>)}</ul>
          )}
          <div className="mt-4"><CodeAnalysisRun hasRepo={hasRepo} readOnly={ctx.readOnly} /></div>
          {settings.codeAnalysisAt && <p className="mt-2 text-xs text-slate-500">Last analysed: {new Date(settings.codeAnalysisAt).toLocaleString()}</p>}
        </div>
      </Card>
      <Card title="Risk zones by module">
        <div className="px-5 py-4">
          {testCases.length === 0 ? <p className="text-sm text-slate-500">No data yet — run a crawl or create test cases.</p> : (
            <ul className="space-y-3">
              {testCases.map((t) => (
                <li key={t.module}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{t.module}</span><span className="text-slate-500">{t._count._all} test cases</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, t._count._all * 6)}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
