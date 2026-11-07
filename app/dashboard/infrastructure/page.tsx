import type { Metadata } from "next";
import { GridNodeForm } from "@/components/dashboard/pages/EngineClients";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Infrastructure" };
export const dynamic = "force-dynamic";

export default async function InfrastructurePage() {
  const ctx = await requireOrgContext();
  const nodes = await prisma.infrastructureGridNode.findMany({ where: { organisationId: ctx.org.id }, orderBy: { browserName: "asc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Test infrastructure" description="Parallel cloud grid: Chrome, Firefox, Safari (WebKit), Edge; worker pools with concurrency caps." />
      <Card title="Register a grid node"><div className="px-5 py-4"><GridNodeForm readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${nodes.length} nodes`}>
        {nodes.length === 0 ? <EmptyState title="No grid nodes" description="Register one above to form your execution grid." /> : (
          <ul className="divide-y divide-slate-100">
            {nodes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium capitalize text-slate-800">{n.browserName} {n.version} <span className="text-xs text-slate-400">· {n.platform}</span></p>
                  <p className="text-xs text-slate-500">{n.activeWorkers}/{n.concurrencyCap} workers · heartbeat {timeAgo(n.lastHeartbeat)}</p>
                </div>
                <StatusPill value={n.status === "IDLE" ? "passing" : n.status === "BUSY" ? "draft" : "failing"} label={n.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
