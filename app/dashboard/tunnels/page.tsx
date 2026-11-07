import type { Metadata } from "next";
import { TunnelActions } from "@/components/dashboard/pages/Forms";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { maskToken } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Tunnels" };
export const dynamic = "force-dynamic";

export default async function TunnelsPage() {
  const ctx = await requireOrgContext();
  const onboarding = await prisma.onboarding.findUnique({ where: { organisationId: ctx.org.id } });
  const readOnly = ctx.readOnly;
  // Full token is shown in the owning workspace; masked in read-only demo.
  const token = onboarding?.tunnelToken ? (readOnly ? maskToken(onboarding.tunnelToken) : onboarding.tunnelToken) : null;
  return (
    <div className="space-y-6">
      <PageHeader kicker="WORK · NEW" title="Tunnels" description="Expose localhost to the AQE engine through a secure tunnel. The token is generated server-side and never sent to other organisations." />
      <Card title="Localhost tunnel">
        <div className="px-5 py-4">
          <TunnelActions token={token} enrolled={onboarding?.tunnelEnrolled ?? false} port={onboarding?.localPort ?? 3000} readOnly={readOnly} />
        </div>
      </Card>
      <Card title="How it works">
        <ol className="list-decimal space-y-1 px-5 py-4 pl-10 text-sm text-slate-600">
          <li>Install the agent: <code>qa tunnel install</code></li>
          <li>Connect with the token above: <code>qa tunnel connect --port 3000</code></li>
          <li>Click “Simulate enrolment” here (no real network call is made in this prototype).</li>
        </ol>
      </Card>
    </div>
  );
}
