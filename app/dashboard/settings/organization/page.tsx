import type { Metadata } from "next";
import { OrgSettingsForm } from "@/components/dashboard/pages/Forms";
import { Card, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Organisation settings" };
export const dynamic = "force-dynamic";

export default async function OrgSettingsPage() {
  const ctx = await requireOrgContext();
  return (
    <div className="space-y-6">
      <PageHeader kicker="SETTINGS" title="Organisation" description={`Slug: ${ctx.org.slug} · plan: ${ctx.org.plan}`} />
      <Card title="General"><div className="px-5 py-4"><OrgSettingsForm name={ctx.org.name} website={ctx.org.website ?? ""} readOnly={ctx.readOnly} /></div></Card>
      <Card title="Danger zone">
        <div className="px-5 py-4">
          <p className="text-sm text-slate-600">Resetting deletes all data of this organisation (test cases, bugs, crawls…). The Acme demo cannot be deleted.</p>
          <div className="mt-3"><ActionButton url="/api/dashboard/settings/organization" method="DELETE" json={{ confirm: ctx.org.slug }} variant="danger" disabled={ctx.readOnly || ctx.org.isMockDemo} confirmText={`This deletes ALL data. Type is pre-filled with your slug "${ctx.org.slug}". Continue?`}>Reset organisation data</ActionButton></div>
        </div>
      </Card>
    </div>
  );
}
