import type { Metadata } from "next";
import { TeamInvite } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requireOrgContext();
  const members = await prisma.user.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Team & access" description="Members of this organisation and their roles." />
      <Card title="Invite a teammate"><div className="px-5 py-4"><TeamInvite readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${members.length} members`}>
        {members.length === 0 ? <EmptyState title="No members" description="Invite your first teammate above." /> : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{m.avatarInitials}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{m.name} {m.email === ctx.user.email && <span className="text-xs text-slate-400">(you)</span>}</p>
                  <p className="truncate text-xs text-slate-500">{m.email} · {m.role}</p>
                </div>
                <StatusPill value={m.status} />
                {m.status === "invited" && <ActionButton url={`/api/dashboard/team/${m.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Revoke this invitation?">Revoke</ActionButton>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
