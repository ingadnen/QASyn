import type { Metadata } from "next";
import { ScheduleForm } from "@/components/dashboard/pages/StudioClients";
import { Card, EmptyState, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { cronPreset } from "@/lib/scheduler";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Schedules" };
export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  const ctx = await requireOrgContext();
  const [schedules, plans] = await Promise.all([
    prisma.schedule.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.testPlan.findMany({ where: { organisationId: ctx.org.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader kicker="INFRASTRUCTURE" title="Schedules" description="Cron-scheduled test plan executions with next-fire computation." />
      <Card title="New schedule"><div className="px-5 py-4"><ScheduleForm plans={plans} readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${schedules.length} schedules`}>
        {schedules.length === 0 ? <EmptyState title="No schedules" description="Schedule your first nightly regression above." /> : (
          <ul className="divide-y divide-slate-100">
            {schedules.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{s.name} <span className="text-xs text-slate-400">{cronPreset(s.cronExpression)}</span></p>
                  <p className="text-xs text-slate-500"><code>{s.cronExpression}</code> · {s.timezone}{s.nextFireAt ? ` · next ${new Date(s.nextFireAt).toLocaleString()}` : ""}{s.lastFiredAt ? ` · last ${timeAgo(s.lastFiredAt)}` : ""}</p>
                </div>
                <ActionButton url={`/api/dashboard/schedules/${s.id}`} method="PATCH" json={{ enabled: !s.enabled }} disabled={ctx.readOnly}>{s.enabled ? "Disable" : "Enable"}</ActionButton>
                <ActionButton url={`/api/dashboard/schedules/${s.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Delete this schedule?">Delete</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
