import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { CreateApiToken } from "@/components/dashboard/pages/CreateApiToken";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Create API token" };
export const dynamic = "force-dynamic";

export default async function CreateApiTokenPage() {
  const ctx = await requirePermission("apiTokens");
  const tokens = await prisma.apiToken.findMany({ where: { organisationId: ctx.org.id }, select: { name: true } });
  return <CreateApiToken readOnly={ctx.readOnly} existingNames={tokens.map((t) => t.name)} />;
}
