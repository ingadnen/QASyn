import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { AnalysisSettings } from "@/components/dashboard/pages/AnalysisSettings";
import { prisma } from "@/lib/db";
import { DEFAULT_ANALYSIS_CODE_SETTINGS, readSettings } from "@/lib/tenant";
import { can } from "@/lib/rbac";

export const metadata: Metadata = { title: "Analysis Settings" };
export const dynamic = "force-dynamic";

export default async function AnalysisSettingsPage() {
  const ctx = await requirePermission("settings");
  const [environments, settings] = await Promise.all([
    prisma.environmentConfig.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, name: true, isDefault: true }, orderBy: { name: "asc" } }),
    Promise.resolve(readSettings(ctx.org)),
  ]);
  const stored = settings.analysisCode;
  const initial = {
    ...DEFAULT_ANALYSIS_CODE_SETTINGS,
    ...(stored ?? {}),
    environmentId: stored?.environmentId || environments.find((e) => e.isDefault)?.id || environments[0]?.id || "",
  };
  return <AnalysisSettings readOnly={ctx.readOnly || !can(ctx.user.role, "settingsManage")} initial={initial} environments={environments} />;
}
