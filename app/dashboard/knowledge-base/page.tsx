import type { Metadata } from "next";
import { KnowledgeCreate } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Knowledge base" };
export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  const ctx = await requireOrgContext();
  const items = await prisma.knowledgeItem.findMany({ where: { organisationId: ctx.org.id }, orderBy: { updatedAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Knowledge base" description="Website, docs and OpenAPI specs indexed by the AQE engine." />
      <Card title="Index a source"><div className="px-5 py-4"><KnowledgeCreate readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${items.length} sources`}>
        {items.length === 0 ? <EmptyState title="Nothing indexed" description="Index your website or a spec above." /> : (
          <ul className="divide-y divide-slate-100">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{i.title}</p>
                  <p className="truncate text-xs text-slate-500">{i.type} · {i.urlOrPath}</p>
                </div>
                <StatusPill value={i.status} />
                <ActionButton url={`/api/dashboard/knowledge-base/${i.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Remove this source?">Remove</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
