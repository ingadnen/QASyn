import type { Metadata } from "next";
import { AgentSuiteForm } from "@/components/dashboard/pages/ContextClients";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Agent suites" };
export const dynamic = "force-dynamic";

export default async function AgentSuitesPage() {
  const ctx = await requireOrgContext();
  const suites = await prisma.agentTestSuite.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="AI AGENT EVALUATOR" title="Agent suites" description="Declare target AI agents (Agentforce, LangChain, Bedrock), attach guardrail watchlists and knowledge base references." />
      <Card title="New agent suite"><div className="px-5 py-4"><AgentSuiteForm readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${suites.length} suites`}>
        {suites.length === 0 ? <EmptyState title="No suites" description="Declare your first agent above, then evaluate it in Agent testing." /> : (
          <ul className="divide-y divide-slate-100">
            {suites.map((s) => {
              let guardrails: string[] = [];
              try {
                guardrails = JSON.parse(s.guardrailsJson || "[]");
              } catch {
                guardrails = [];
              }
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">{s.agentEndpoint} · {guardrails.length} guardrails</p>
                  </div>
                  <StatusPill value={s.lastVerdict === "passed" ? "passing" : s.lastVerdict === "failed" ? "failing" : "draft"} label={s.lastVerdict ?? "unevaluated"} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
