import type { Metadata } from "next";
import { AnalysisSettings } from "@/components/dashboard/pages/AnalysisSettings";
import { prisma } from "@/lib/db";
import { DEFAULT_ANALYSIS_CODE_SETTINGS, readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Analysis Settings" };
export const dynamic = "force-dynamic";

export default async function AnalysisSettingsPage() {
  const ctx = await requireOrgContext();
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
  return <AnalysisSettings readOnly={ctx.readOnly} initial={initial} environments={environments} />;
}
