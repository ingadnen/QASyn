import type { Metadata } from "next";
import { SaasAiTest } from "@/components/dashboard/pages/EngineClients";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "SaaS AI tools" };
export const dynamic = "force-dynamic";

export default async function SaasAiToolsPage() {
  const ctx = await requireOrgContext();
  return (
    <div className="space-y-6">
      <PageHeader kicker="SOLUTIONS" title="SaaS AI tools" description="Test AI copilots and chatbots embedded in your app: prompt drift, hallucination rate and fallback behavior." />
      <Card title="Copilot evaluation"><div className="px-5 py-4"><SaasAiTest readOnly={ctx.readOnly} /></div></Card>
    </div>
  );
}
