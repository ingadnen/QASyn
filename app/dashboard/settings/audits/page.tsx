import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "System audits" };
export const dynamic = "force-dynamic";

export default async function AuditsPage() {
  const ctx = await requireOrgContext();
  const logs = await prisma.systemAuditLog.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="space-y-6">
      <PageHeader kicker="SETTINGS" title="System audits" description="Every action performed by members of this organisation." />
      <Card title={`${logs.length} events`}>
        {logs.length === 0 ? <EmptyState title="No audit events" description="Actions you take will be recorded here." /> : (
          <ul className="divide-y divide-slate-100">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{l.action}</code>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{l.target}</span>
                <span className="text-xs text-slate-500">{l.actorEmail} · {timeAgo(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
