import type { Metadata } from "next";
import { ContextForm } from "@/components/dashboard/pages/ContextClients";
import { Card, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Context graph" };
export const dynamic = "force-dynamic";

export default async function ContextPage() {
  const ctx = await requireOrgContext();
  const [sources, nodes, edges] = await Promise.all([
    prisma.contextSource.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.contextGraphNode.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.contextGraphEdge.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader kicker="CONTEXT GRAPH ENGINE" title="Context graph" description="Ingest Jira stories, Swagger docs, Figma layouts, raw URLs and video logs. Each source derives a knowledge-graph node." />
      <Card title="Ingest a source"><div className="px-5 py-4"><ContextForm readOnly={ctx.readOnly} /></div></Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`Sources (${sources.length})`}>
          {sources.length === 0 ? <EmptyState title="No sources" description="Ingest one above." /> : (
            <ul className="divide-y divide-slate-100 px-5 py-2">
              {sources.map((s) => (
                <li key={s.id} className="py-2">
                  <p className="truncate text-sm font-medium text-slate-800">{s.sourceUrl}</p>
                  <p className="text-xs text-slate-500">{s.type} · {s.extractedText.length} chars extracted</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Nodes (${nodes.length})`}>
          {nodes.length === 0 ? <EmptyState title="No nodes" description="Nodes are derived from sources." /> : (
            <ul className="divide-y divide-slate-100 px-5 py-2">
              {nodes.map((n) => (
                <li key={n.id} className="py-2">
                  <p className="truncate text-sm font-medium text-slate-800">{n.entityName}</p>
                  <p className="text-xs text-slate-500">{n.entityType}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Edges (${edges.length})`}>
          {edges.length === 0 ? <EmptyState title="No edges" description="Edges link nodes (covers, implements, blocks, related_to)." /> : (
            <ul className="divide-y divide-slate-100 px-5 py-2">
              {edges.map((e) => (
                <li key={e.id} className="py-2 text-sm text-slate-700">{e.sourceId.slice(0, 8)} → {e.targetId.slice(0, 8)} <span className="text-xs text-slate-500">({e.relationType})</span></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
