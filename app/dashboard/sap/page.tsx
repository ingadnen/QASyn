import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { platformAssertions, platformStepsFor } from "@/lib/platform-testing";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "SAP testing" };
export const dynamic = "force-dynamic";

export default async function SapPage() {
  const ctx = await requireOrgContext();
  const cases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, take: 10, select: { id: true, title: true } });
  const steps = platformStepsFor("sap", "VA01 create sales order\nBAPI_SALESORDER_CREATEFROMDAT2\nVerify iDoc status");
  return (
    <div className="space-y-6">
      <PageHeader kicker="ENTERPRISE" title="SAP testing" description="Fiori/GUI, transaction-based flows, BAPI and iDoc validation assertions." />
      <Card title="Supported step types">
        <ul className="grid gap-2 px-5 py-4 sm:grid-cols-2">
          {steps.map((s) => <li key={s.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><strong>{s.action}</strong> — {s.target}</li>)}
        </ul>
      </Card>
      <Card title="Assertions">
        <ul className="px-5 py-3">
          {platformAssertions("sap").map((a) => <li key={a.label} className="py-1 text-sm text-slate-700">{a.label} <span className="text-xs text-slate-400">({a.kind})</span></li>)}
        </ul>
      </Card>
      <Card title="Test cases in this workspace">
        {cases.length === 0 ? <EmptyState title="No test cases" description="Create test cases, then open them from SAP flows." /> : (
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {cases.map((c) => <li key={c.id} className="py-1.5 text-sm"><a className="font-medium text-brand-700 hover:underline" href={`/dashboard/test-cases/${c.id}`}>{c.title}</a></li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
