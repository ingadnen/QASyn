import type { Metadata } from "next";
import { IntegrationsClient } from "@/components/dashboard/pages/Forms";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await requireOrgContext();
  const items = await prisma.integration.findMany({ where: { organisationId: ctx.org.id } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="WORK" title="Integrations" description="GitHub, GitLab, Jira, Linear and Slack connections for this organisation." />
      <Card title="Connections"><div className="px-5 py-4"><IntegrationsClient items={items.map((i) => ({ provider: i.provider, status: i.status, detail: i.detail }))} readOnly={ctx.readOnly} /></div></Card>
    </div>
  );
}
