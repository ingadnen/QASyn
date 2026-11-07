import type { Metadata } from "next";
import { TestCasesClient } from "@/components/dashboard/pages/TestCasesClient";
import { PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Test cases" };
export const dynamic = "force-dynamic";

export default async function TestCasesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const ctx = await requireOrgContext();
  const { new: openNew } = await searchParams;
  const testCases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: [{ module: "asc" }, { createdAt: "desc" }] });
  const rows = testCases.map((t) => ({
    id: t.id,
    title: t.title,
    module: t.module,
    criticality: t.criticality,
    status: t.status,
    stepsCount: t.stepsCount,
    source: t.source,
    lastRunAt: t.lastRunAt?.toISOString() ?? null,
  }));
  return (
    <div className="space-y-6">
      <PageHeader kicker="PLATFORM" title="Test cases" description={`${rows.length} test cases across ${new Set(rows.map((r) => r.module)).size} modules. Runs are simulated and cost 5 credits each.`} />
      <TestCasesClient rows={rows} readOnly={ctx.readOnly} openNew={openNew === "1"} />
    </div>
  );
}
