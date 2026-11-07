import type { Metadata } from "next";
import { ApiChainForm } from "@/components/dashboard/pages/ContextClients";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "API chains" };
export const dynamic = "force-dynamic";

export default async function ApiChainsPage() {
  const ctx = await requireOrgContext();
  const chains = await prisma.apiTestChain.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="API CHAINING STUDIO" title="API chains" description="Isolated request chains executed with real HTTP: extract variables and inject them into dependent requests." />
      <Card title="New chain"><div className="px-5 py-4"><ApiChainForm readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${chains.length} chains`}>
        {chains.length === 0 ? <EmptyState title="No chains" description="Create one above, then execute it from the API testing studio." /> : (
          <ul className="divide-y divide-slate-100">
            {chains.map((c) => {
              let count = 0;
              try {
                count = (JSON.parse(c.requestsJson || "[]") as unknown[]).length;
              } catch {
                count = 0;
              }
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <span className="text-xs text-slate-500">{count} requests</span>
                  <span className="ml-auto"><StatusPill value={c.status === "passed" ? "passing" : c.status === "failed" ? "failing" : "draft"} label={c.status} /></span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
