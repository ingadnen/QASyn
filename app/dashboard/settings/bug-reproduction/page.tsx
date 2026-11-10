import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { BugReproductionSettingsForm } from "@/components/dashboard/pages/BugReproductionSettings";
import { prisma } from "@/lib/db";
import { DEFAULT_BUG_REPRODUCTION_SETTINGS, readSettings } from "@/lib/tenant";
import { can } from "@/lib/rbac";

export const metadata: Metadata = { title: "Bug Reproduction Settings" };
export const dynamic = "force-dynamic";

export default async function BugReproSettingsPage() {
  const ctx = await requirePermission("settings");
  const [environments, profiles, linear, settings] = await Promise.all([
    prisma.environmentConfig.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, name: true, isDefault: true }, orderBy: { name: "asc" } }),
    prisma.dataProfile.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, name: true, environmentIds: true }, orderBy: { name: "asc" } }),
    prisma.integration.findFirst({ where: { organisationId: ctx.org.id, provider: "LINEAR", status: "CONNECTED" }, select: { id: true } }),
    Promise.resolve(readSettings(ctx.org)),
  ]);
  const stored = settings.bugReproductionSettings;
  const initial = {
    ...DEFAULT_BUG_REPRODUCTION_SETTINGS,
    ...(stored ?? {}),
    environmentId: stored?.environmentId || environments.find((e) => e.isDefault)?.id || environments[0]?.id || "",
  };
  return (
    <BugReproductionSettingsForm
      readOnly={ctx.readOnly || !can(ctx.user.role, "settingsManage")}
      initial={initial}
      environments={environments}
      dataProfiles={profiles.map((p) => {
        let ids: string[] = [];
        try {
          const parsed = JSON.parse(p.environmentIds) as unknown;
          if (Array.isArray(parsed)) ids = parsed.filter((v): v is string => typeof v === "string");
        } catch {
          ids = [];
        }
        return { id: p.id, name: p.name, environmentIds: ids };
      })}
      linearConnected={Boolean(linear)}
    />
  );
}
