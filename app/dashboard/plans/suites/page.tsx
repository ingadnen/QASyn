import type { Metadata } from "next";
import { CollectionCreate } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Test suites" };
export const dynamic = "force-dynamic";

export default async function SuitesPage() {
  const ctx = await requireOrgContext();
  const suites = await prisma.testSuite.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Test suites" description="Reusable groups of test cases, runnable on demand or on a schedule." />
      <Card title="New suite"><div className="px-5 py-4"><CollectionCreate kind="suites" readOnly={ctx.readOnly} /></div></Card>
      <Card title={`${suites.length} suites`}>
        {suites.length === 0 ? <EmptyState title="No suites" description="Create your first suite above." /> : (
          <ul className="divide-y divide-slate-100">
            {suites.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.description ?? "—"} · {s.schedule}{s.module ? ` · ${s.module}` : ""} · {s.testCasesCount} cases · {Math.round(s.passRate)}% pass{s.lastRunAt ? ` · last run ${timeAgo(s.lastRunAt)}` : ""}</p>
                </div>
                <ActionButton url={`/api/dashboard/collections/suites/${s.id}`} method="PATCH" json={{ action: "run" }} disabled={ctx.readOnly}>Run</ActionButton>
                <ActionButton url={`/api/dashboard/collections/suites/${s.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText="Delete this suite?">Delete</ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
