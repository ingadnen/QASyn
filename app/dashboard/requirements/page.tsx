import type { Metadata } from "next";
import { LinkTests } from "@/components/dashboard/pages/LinkTests";
import { RequirementCreate } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Requirements" };
export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const ctx = await requireOrgContext();
  const reqs = await prisma.requirement.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, include: { testCases: { select: { id: true, title: true } } } });
  const testCases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: { title: "asc" }, select: { id: true, title: true } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Requirements" description="Product requirements and their traceability to test cases." />
      <Card title="Add or import"><div className="px-5 py-4"><RequirementCreate readOnly={ctx.readOnly} /></div></Card>
      <Card title="Auto-generate from sources">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <p className="flex-1 text-sm text-slate-600">Parse documents, Jira stories and Figma frames into testable criteria, then generate NLP test cases. Ingest a source first in Context graph.</p>
          <a href="/dashboard/context" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500">Open Context graph</a>
          <a href="/dashboard/requirements" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">View traceability matrix (linked tests below)</a>
        </div>
      </Card>
      <Card title={`${reqs.length} requirements`}>
        {reqs.length === 0 ? <EmptyState title="No requirements" description="Add one manually or bulk-import it." /> : (
          <ul className="divide-y divide-slate-100">
            {reqs.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{r.code}</code>
                  <span className="font-medium text-slate-800">{r.title}</span>
                  <StatusPill value={r.coverageStatus} />
                  <span className="text-xs text-slate-500">{r.source} · {r.testCases.length} linked tests</span>
                  <span className="ml-auto"><ActionButton url={`/api/dashboard/requirements/${r.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText={`Delete ${r.code}?`}>Delete</ActionButton></span>
                </div>
                {testCases.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-brand-600">Link test cases</summary>
                    <LinkTests itemId={r.id} testCases={testCases} linkedIds={r.testCases.map((t) => t.id)} readOnly={ctx.readOnly} />
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
