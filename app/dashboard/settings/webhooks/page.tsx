import type { Metadata } from "next";
import { SettingsSimpleForm } from "@/components/dashboard/pages/SettingsClients";
import { Card, EmptyState, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Webhooks" };
export const dynamic = "force-dynamic";

export default async function WebhooksSettingsPage() {
  const ctx = await requireOrgContext();
  const webhooks = await prisma.webhook.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="CI/CD" title="Webhooks" description="Outbound result delivery with retry. Inbound trigger: POST /api/webhooks/trigger (Bearer cqa_…)." />
      <Card title="New webhook"><div className="px-5 py-4"><SettingsSimpleForm kind="webhook" readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${webhooks.length} webhooks`}>
        {webhooks.length === 0 ? <EmptyState title="No webhooks" description="Create one above for CI/CD delivery." /> : (
          <ul className="divide-y divide-slate-100">
            {webhooks.map((w) => {
              let events: string[] = [];
              try {
                events = JSON.parse(w.events || "[]");
              } catch {
                events = [];
              }
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{w.name}</p>
                    <p className="truncate text-xs text-slate-500">{w.url} · {events.join(", ") || "—"}{w.lastDeliveredAt ? ` · last ${new Date(w.lastDeliveredAt).toLocaleString()}` : ""}</p>
                  </div>
                  <ActionButton url={`/api/dashboard/webhooks/${w.id}`} method="PATCH" json={{ active: !w.active }} disabled={ctx.readOnly}>{w.active ? "Deactivate" : "Activate"}</ActionButton>
                  <ActionButton url={`/api/dashboard/webhooks/${w.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Delete this webhook?">Delete</ActionButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
