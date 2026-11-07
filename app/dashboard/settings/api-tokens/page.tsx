import type { Metadata } from "next";
import { ApiTokenCreate } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "API tokens" };
export const dynamic = "force-dynamic";

export default async function ApiTokensPage() {
  const ctx = await requireOrgContext();
  const tokens = await prisma.apiToken.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="SETTINGS" title="API tokens" description="Tokens are shown once at creation (cqa_…). Only their hash is stored." />
      <Card title="New token"><div className="px-5 py-4"><ApiTokenCreate readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${tokens.length} tokens`}>
        {tokens.length === 0 ? <EmptyState title="No tokens" description="Create one above for CI or MCP clients." /> : (
          <ul className="divide-y divide-slate-100">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-500"><code>{t.tokenPrefix}…</code> · created {timeAgo(t.createdAt)}{t.lastUsedAt ? ` · last used ${timeAgo(t.lastUsedAt)}` : " · never used"}</p>
                </div>
                <ActionButton url={`/api/dashboard/api-tokens/${t.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Revoke this token?">Revoke</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
