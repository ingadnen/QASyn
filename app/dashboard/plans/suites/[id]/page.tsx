import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Suite detail" };
export const dynamic = "force-dynamic";

export default async function SuiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const suite = await prisma.testSuite.findFirst({ where: { id, organisationId: ctx.org.id }, include: { testCases: true } });
  if (!suite) notFound();
  const cases = suite.testCases.length
    ? suite.testCases
    : await prisma.testCase.findMany({ where: { organisationId: ctx.org.id, ...(suite.module ? { module: suite.module } : {}) }, take: 20 });
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="PLANS · TEST SUITES"
        title={suite.name}
        description={`${suite.description ?? "—"} · schedule: ${suite.schedule}${suite.module ? ` · module: ${suite.module}` : ""} · ${Math.round(suite.passRate)}% pass rate${suite.lastRunAt ? ` · last run ${timeAgo(suite.lastRunAt)}` : " · not executed yet"}`}
        actions={
          <>
            <StatusPill value={suite.passRate >= 70 ? "passing" : suite.passRate > 0 ? "failing" : "draft"} label={suite.lastRunAt ? `${Math.round(suite.passRate)}% pass` : "Not executed"} />
            <ActionButton url={`/api/dashboard/collections/suites/${suite.id}`} method="PATCH" json={{ action: "run" }} disabled={ctx.readOnly}>Run suite</ActionButton>
            <Link href="/dashboard/plans/suites" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">← All suites</Link>
          </>
        }
      />
      <Card title={`${cases.length} test cases`}>
        {cases.length === 0 ? <EmptyState title="No test cases" description="Add cases from Test cases — they will appear here." /> : (
          <ul className="divide-y divide-slate-100">
            {cases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Link href={`/dashboard/test-studio/${c.id}`} className="min-w-0 flex-1 font-medium text-brand-700 hover:underline">{c.title}</Link>
                <StatusPill value={c.status} />
                <span className="text-xs text-slate-500">{c.module} · {c.criticality}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
