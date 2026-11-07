import type { Metadata } from "next";
import { ShipExecuteFull } from "@/components/dashboard/pages/AgentClients";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Continuous testing" };
export const dynamic = "force-dynamic";

export default async function ContinuousTestingPage() {
  const ctx = await requireOrgContext();
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Continuous testing" description="Always-on release monitor: canary validation, regression rollback alerts and CI quality gates." />
      <Card title="Canary release validation">
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-slate-600">Trigger a full Ship pipeline to validate the canary: crawl → requirements → NLP cases → Playwright execution → Go/No-Go verdict.</p>
          <ShipExecuteFull readOnly={ctx.readOnly} />
        </div>
      </Card>
      <Card title="Quality gates">
        <ul className="divide-y divide-slate-100 px-5 py-3 text-sm text-slate-700">
          <li className="flex justify-between py-2"><span>Pass rate gate</span><strong>≥ 70% to promote</strong></li>
          <li className="flex justify-between py-2"><span>Regression gate</span><strong>0 new regressions allowed</strong></li>
          <li className="flex justify-between py-2"><span>Visual gate</span><strong>mismatch ≤ 1%</strong></li>
          <li className="flex justify-between py-2"><span>Rollback alert</span><strong>Slack + webhook on No-Go</strong></li>
        </ul>
      </Card>
    </div>
  );
}
