import type { Metadata } from "next";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { NewRequirementButton } from "@/components/dashboard/pages/NewRequirementButton";
import { RequirementRowActions } from "@/components/dashboard/pages/RequirementRowActions";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Requirements" };
export const dynamic = "force-dynamic";

/** Live status vocabulary used by the Requirements Library. */
function libraryStatus(coverageStatus: string): string {
  if (coverageStatus === "covered") return "Completed";
  if (coverageStatus === "partial") return "In Progress";
  return "Pending Action";
}

export default async function RequirementsPage() {
  const ctx = await requireOrgContext();
  const [reqs, testCases] = await Promise.all([
    prisma.requirement.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      include: { testCases: { select: { id: true, title: true } } },
    }),
    prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="PLATFORM"
        title="Requirements Library"
        description="Upload requirements, review questionnaires, track test case generation, and manage change history"
        actions={<NewRequirementButton readOnly={ctx.readOnly} />}
      />
      <Card title={`${reqs.length} requirements`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] tracking-widest text-slate-400 uppercase">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Format</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Test Plan</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Test Cases</th>
                <th className="px-4 py-2">Created by</th>
                <th className="px-4 py-2">Created Date</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {reqs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center">
                    <EmptyState title="No requirements yet" description="Upload requirements or create one with + New Requirement." />
                  </td>
                </tr>
              )}
              {reqs.map((r) => {
                const linked = r.testCases.length || r.linkedTestsCount;
                const isCrawl = r.source === "doc" || r.source === "crawl";
                return (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5">
                      <span className="block text-xs font-semibold tracking-wide text-slate-500">{r.code}</span>
                      <span className="font-medium text-slate-800">{r.title}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{isCrawl ? "Auto Crawl" : r.source.charAt(0).toUpperCase() + r.source.slice(1)}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <span className="block">language</span>
                      <span className="block text-xs capitalize text-slate-500">{isCrawl ? "Crawl" : r.source}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">—</td>
                    <td className="px-4 py-2.5">
                      <StatusPill value={r.coverageStatus === "covered" ? "completed" : r.coverageStatus} label={libraryStatus(r.coverageStatus)} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <span className="font-semibold text-slate-800">{linked}</span> Linked
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{ctx.user.name}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <RequirementRowActions
                        requirement={{ id: r.id, code: r.code, title: r.title }}
                        testCases={testCases}
                        linkedIds={r.testCases.map((t) => t.id)}
                        readOnly={ctx.readOnly}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
