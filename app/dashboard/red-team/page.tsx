import type { Metadata } from "next";
import { RedTeamForm } from "@/components/dashboard/pages/RedTeamClient";
import { StrixScanner } from "@/components/dashboard/pages/StrixScanner";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Red team" };
export const dynamic = "force-dynamic";

export default async function RedTeamPage() {
  const ctx = await requireOrgContext();
  const suites = await prisma.redTeamSuite.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <div className="space-y-6">
      <PageHeader kicker="ENTERPRISE" title="Red team" description="Automated adversarial prompts (OWASP LLM Top 10) with vulnerability scoring and regression." />
      <StrixScanner readOnly={ctx.readOnly} defaultTarget={ctx.org.website ?? "https://www.cgi.com"} />
      <Card title="Run red team suite"><div className="px-5 py-4"><RedTeamForm readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${suites.length} suites`}>
        {suites.length === 0 ? <EmptyState title="No suites yet" description="Run your first red team suite above." /> : (
          <ul className="divide-y divide-slate-100">
            {suites.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-500">{timeAgo(s.createdAt)}</p>
                </div>
                <StatusPill value={s.score >= 70 ? "passing" : "failing"} label={`score ${s.score}%`} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
