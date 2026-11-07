import type { Metadata } from "next";
import Link from "next/link";
import { SuiteDetailTabs } from "@/components/dashboard/pages/SuiteDetailTabs";
import { PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
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
  const allCases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: { title: "asc" }, select: { id: true, title: true } });
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="PLANS · TEST SUITES"
        title={suite.name}
        description={`${suite.description ?? "—"} · schedule: ${suite.schedule}${suite.module ? ` · module: ${suite.module}` : ""} · ${Math.round(suite.passRate)}% pass rate${suite.lastRunAt ? ` · last run ${timeAgo(suite.lastRunAt)}` : " · Not executed"}`}
        actions={
          <>
            <StatusPill value={suite.passRate >= 70 ? "passing" : suite.passRate > 0 ? "failing" : "draft"} label={suite.lastRunAt ? `${Math.round(suite.passRate)}% pass` : "Not executed"} />
            <ActionButton url={`/api/dashboard/collections/suites/${suite.id}`} method="PATCH" json={{ action: "run" }} disabled={ctx.readOnly}>Run suite</ActionButton>
            <Link href="/dashboard/plans/suites" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">← All suites</Link>
          </>
        }
      />
      <SuiteDetailTabs
        suite={{ id: suite.id, name: suite.name, description: suite.description, schedule: suite.schedule, passRate: suite.passRate, lastRunAt: suite.lastRunAt?.toISOString() ?? null, linkedCaseIds: suite.testCases.map((c) => c.id) }}
        cases={suite.testCases.map((c) => ({ id: c.id, title: c.title, status: c.status }))}
        allCases={allCases}
        readOnly={ctx.readOnly}
      />
    </div>
  );
}
