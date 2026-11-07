import type { Metadata } from "next";
import { AnalysisForm } from "@/components/dashboard/pages/Forms";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Analysis settings" };
export const dynamic = "force-dynamic";

export default async function AnalysisSettingsPage() {
  const ctx = await requireOrgContext();
  const initial = readSettings(ctx.org).analysis ?? { severityThreshold: "high", blockOnRegression: true, autoHealing: false, minCoverage: 80, prComment: true };
  return (
    <div className="space-y-6">
      <PageHeader kicker="SETTINGS" title="Analysis settings" description="Severity thresholds, PR check rules and auto-healing." />
      <Card title="Analysis">
        <div className="px-5 py-4"><AnalysisForm initial={initial} readOnly={ctx.readOnly} /></div>
      </Card>
    </div>
  );
}
