import type { Metadata } from "next";
import { Integrations } from "@/components/dashboard/pages/IntegrationsParity";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await requireOrgContext();
  const items = await prisma.integration.findMany({ where: { organisationId: ctx.org.id } });
  const connected = items
    .filter((item) => ["CONNECTED", "INDEXING"].includes(item.status))
    .map((item) => item.provider);

  return <Integrations connected={connected} readOnly={ctx.readOnly} />;
}
