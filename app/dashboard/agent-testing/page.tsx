import type { Metadata } from "next";
import { AgentTestingForm, DbCheckForm } from "@/components/dashboard/pages/AgentClients";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "AI agent testing" };
export const dynamic = "force-dynamic";

export default async function AgentTestingPage() {
  const ctx = await requireOrgContext();
  const tests = await prisma.agentTest.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div className="space-y-6">
      <PageHeader kicker="AI AGENT TESTING" title="AI agent testing" description="Guardrails, hallucination detection and tool-call validation for LLM agents, plus database and ERP assertions." />
      <Card title="New agent test"><div className="px-5 py-4"><AgentTestingForm readOnly={ctx.readOnly} /></div></Card>
      <Card title="Database & ERP checks"><div className="px-5 py-4"><DbCheckForm readOnly={ctx.readOnly} /></div></Card>
      <Card title="History">
        {tests.length === 0 ? <EmptyState title="No agent tests yet" description="Evaluate a model response above." /> : (
          <ul className="divide-y divide-slate-100">
            {tests.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.kind}{t.lastRunAt ? ` · ${timeAgo(t.lastRunAt)}` : ""}</p>
                </div>
                <StatusPill value={t.status === "passed" ? "passing" : t.status === "failed" ? "failing" : "draft"} label={t.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
