import type { Metadata } from "next";
import { EnvironmentCreate } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, ActionButton, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Environments" };
export const dynamic = "force-dynamic";

export default async function EnvironmentsPage() {
  const ctx = await requireOrgContext();
  const envs = await prisma.environmentConfig.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Environment & data" description="Staging, QA and localhost environments with test data variables." />
      <Card title="New environment"><div className="px-5 py-4"><EnvironmentCreate readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${envs.length} environments`}>
        {envs.length === 0 ? <EmptyState title="No environments" description="Add Staging, QA or Localhost above." /> : (
          <ul className="divide-y divide-slate-100">
            {envs.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{e.name} {e.isDefault && <StatusPill value="active" label="default" />}</p>
                  <p className="truncate text-xs text-slate-500">{e.baseUrl} · auth: {e.authType} · variables: {Object.keys(JSON.parse(e.variablesJson || "{}")).join(", ") || "none"}</p>
                </div>
                {!e.isDefault && <ActionButton url={`/api/dashboard/environments/${e.id}`} json={{ action: "default" }} disabled={ctx.readOnly}>Set default</ActionButton>}
                <ActionButton url={`/api/dashboard/environments/${e.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Delete this environment?">Delete</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
