import type { Metadata } from "next";
import { RiskForm } from "@/components/dashboard/pages/EngineClients";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Risk testing" };
export const dynamic = "force-dynamic";

export default async function RiskTestingPage() {
  const ctx = await requireOrgContext();
  const analyses = await prisma.riskAnalysis.findMany({ where: { organisationId: ctx.org.id }, orderBy: { analyzedAt: "desc" }, take: 20 });
  return (
    <div className="space-y-6">
      <PageHeader kicker="SOLUTIONS" title="Risk-based testing" description="Commit churn + flakiness → risk score (0–100) and prioritized test runs." />
      <Card title="New analysis"><div className="px-5 py-4"><RiskForm readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${analyses.length} analyses`}>
        {analyses.length === 0 ? <EmptyState title="No analyses" description="Compute a risk score above." /> : (
          <ul className="divide-y divide-slate-100">
            {analyses.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{a.branchName}</p>
                  <p className="text-xs text-slate-500">{a.prNumber ? `PR #${a.prNumber} · ` : ""}{timeAgo(a.analyzedAt)}</p>
                </div>
                <span className="text-sm font-semibold">{a.riskScore}/100</span>
                <StatusPill value={a.riskLevel === "LOW" ? "passing" : a.riskLevel === "MEDIUM" ? "draft" : "failing"} label={a.riskLevel} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
