import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { planEntitlements, type PlanTier } from "@/lib/entitlements";
import { guardAnyPermission } from "@/lib/rbac-server";

export const dynamic = "force-dynamic";

/** GET /api/dashboard/entitlements — the plan entitlement matrix for this org. */
export async function GET() {
  const guard = await guardAnyPermission(["billing", "settings", "overview"]);
  if (!guard.ok) return guard.response;
  const plan = (guard.ctx.org.plan ?? "free") as PlanTier;
  const [members, integrations] = await Promise.all([
    prisma.user.count({ where: { organisationId: guard.ctx.org.id } }),
    prisma.integration.findMany({
      where: { organisationId: guard.ctx.org.id, status: "CONNECTED" },
      select: { provider: true },
    }),
  ]);
  const entitlements = planEntitlements(plan);
  return NextResponse.json({
    plan,
    entitlements: {
      ...entitlements,
      seats: Number.isFinite(entitlements.seats) ? entitlements.seats : -1,
      projects: Number.isFinite(entitlements.projects) ? entitlements.projects : -1,
      creditsPerMonth: Number.isFinite(entitlements.creditsPerMonth) ? entitlements.creditsPerMonth : -1,
    },
    usage: { seats: members, projects: new Set(integrations.map((item) => item.provider)).size },
    connectedIntegrations: integrations.map((item) => item.provider),
  });
}
