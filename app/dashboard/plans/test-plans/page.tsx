import type { Metadata } from "next";
import { CollectionCreate } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Test plans" };
export const dynamic = "force-dynamic";

export default async function TestPlansPage() {
  const ctx = await requireOrgContext();
  const plans = await prisma.testPlan.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Test plans" description="Scheduled verification campaigns per environment." />
      <Card title="New plan"><div className="px-5 py-4"><CollectionCreate kind="test-plans" readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${plans.length} plans`}>
        {plans.length === 0 ? <EmptyState title="No plans" description="Create your first plan above." /> : (
          <ul className="divide-y divide-slate-100">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.description ?? "—"} · {p.schedule}{p.environment ? ` · ${p.environment}` : ""} · {p.testCasesCount} cases · {Math.round(p.passRate)}% pass{p.lastRunAt ? ` · last run ${timeAgo(p.lastRunAt)}` : ""}</p>
                </div>
                <ActionButton url={`/api/dashboard/collections/test-plans/${p.id}`} method="PATCH" json={{ action: "run" }} disabled={ctx.readOnly}>Run</ActionButton>
                <ActionButton url={`/api/dashboard/collections/test-plans/${p.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Delete this plan?">Delete</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
