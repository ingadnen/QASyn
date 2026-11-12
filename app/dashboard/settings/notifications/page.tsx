import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { SettingsSimpleForm } from "@/components/dashboard/pages/SettingsClients";
import { Card, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { formatEmail, formatSlackMessage, formatTeamsMessage } from "@/lib/notifications";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requirePermission("settings");
  const rules = await prisma.notificationRule.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="ADMIN" title="Notifications" description="Slack, Teams and email rules for test failures, regressions and crawl completion." />
      <Card title="New rule"><div className="px-5 py-4"><SettingsSimpleForm kind="notification" readOnly={ctx.readOnly || !can(ctx.user.role, "settingsManage")} /></div></Card>
      <Card title={`${rules.length} rules`}>
        {rules.length === 0 ? <EmptyState title="No rules" description="Create a rule above." /> : (
          <ul className="divide-y divide-slate-100">
            {rules.map((r) => {
              let events: string[] = [];
              try {
                events = JSON.parse(r.events || "[]");
              } catch {
                events = [];
              }
              const preview = r.channel === "slack" ? formatSlackMessage(events[0] ?? "test.failed", "Sample alert", "Test run failed") : r.channel === "teams" ? formatTeamsMessage(events[0] ?? "test.failed", "Sample alert", "Test run failed") : `${formatEmail(events[0] ?? "test.failed", "Sample alert", "Test run failed").subject}`;
              return (
                <li key={r.id} className="px-5 py-3">
                  <p className="text-sm font-medium capitalize text-slate-800">{r.channel} <span className="text-xs text-slate-400">{r.enabled ? "enabled" : "disabled"}</span></p>
                  <p className="text-xs text-slate-500">{events.join(", ") || "—"}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">Preview: {preview.slice(0, 120)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
