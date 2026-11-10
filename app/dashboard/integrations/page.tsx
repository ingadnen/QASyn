import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { Integrations, type IntegrationRow } from "@/components/dashboard/pages/IntegrationsParity";
import { prisma } from "@/lib/db";
import { parseIntegrationConfig } from "@/lib/integration-providers";
import { can } from "@/lib/rbac";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await requirePermission("integrations");
  const items = await prisma.integration.findMany({
    where: { organisationId: ctx.org.id },
    orderBy: { updatedAt: "desc" },
  });
  const integrations: IntegrationRow[] = items.map((item) => ({
    provider: item.provider,
    status: item.status,
    detail: item.detail,
    config: parseIntegrationConfig(item.configJson),
    lastSyncAt: item.lastSyncAt?.toISOString() ?? null,
    connectedAt: item.connectedAt.toISOString(),
  }));

  return <Integrations integrations={integrations} readOnly={ctx.readOnly || !can(ctx.user.role, "integrationsManage")} />;
}
