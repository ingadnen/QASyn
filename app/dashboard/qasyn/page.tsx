import type { Metadata } from "next";
import Link from "next/link";
import { BugReproForm, PrImpactForm, QasynWorkflowRun } from "@/components/dashboard/pages/EnginesClient";
import { QasynExecuteFull } from "@/components/dashboard/pages/AgentClients";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "QASyn" };
export const dynamic = "force-dynamic";

export default async function QasynPage() {
  const ctx = await requireOrgContext();
  const [analyses, workflows] = await Promise.all([
    prisma.prAnalysis.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.shipWorkflow.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader kicker="AUTONOMOUS QASYN WORKFLOWS" title="QASyn" description="The autonomous QA engineer: PR impact analysis, bug reproduction and evidence-based Go / No-Go decisions." />
      <Card title="Full QASyn execution (crawl → requirements → test cases → plan → release report)">
        <div className="px-5 py-4"><QasynExecuteFull readOnly={ctx.readOnly} /></div>
      </Card>
      <Card title="Autonomous pipeline (crawl → generate → execute → report)">
        <div className="px-5 py-4"><QasynWorkflowRun readOnly={ctx.readOnly} /></div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="PR impact analysis"><div className="px-5 py-4"><PrImpactForm readOnly={ctx.readOnly} /></div></Card>
        <Card title="Bug reproduction from a support ticket"><div className="px-5 py-4"><BugReproForm readOnly={ctx.readOnly} /></div></Card>
      </div>
      <Card title="Recent PR analyses">
        {analyses.length === 0 ? <EmptyState title="No PR analyses" description="Analyze a PR above to see the regression scope and decision." /> : (
          <ul className="divide-y divide-slate-100">
            {analyses.map((a) => {
              let assessment: { modules?: string[]; cases?: number; reason?: string } = {};
              try {
                assessment = JSON.parse(a.impactAssessment || "{}");
              } catch {
                assessment = {};
              }
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">#{a.prNumber} {a.title}</p>
                    <p className="text-xs text-slate-500">{a.branch} · risk {a.riskLevel} · {assessment.cases ?? 0} cases · {assessment.reason ?? ""} · {timeAgo(a.createdAt)}</p>
                  </div>
                  <StatusPill value={a.decision === "Go" ? "passing" : "failing"} label={`${a.decision} decision`} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title="Workflow history">
        {workflows.length === 0 ? <EmptyState title="No workflows" description="Run the autonomous pipeline above." /> : (
          <ul className="divide-y divide-slate-100">
            {workflows.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{w.name}</p>
                  <p className="text-xs text-slate-500">{w.decisionReason ?? ""} · {timeAgo(w.createdAt)}</p>
                </div>
                <StatusPill value={w.decision === "Go" ? "passing" : "failing"} label={w.decision} />
                <Link href="/dashboard/test-cases?new=1" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500">
                  Convert Flow → Test Case
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
