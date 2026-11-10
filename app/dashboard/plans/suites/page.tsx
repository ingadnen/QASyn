import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { SuitesClient, type SuiteRow } from "@/components/dashboard/pages/SuitesClient";
import { PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { syncSuiteLinks } from "@/lib/plan-sync";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Test suites" };
export const dynamic = "force-dynamic";

export default async function SuitesPage() {
  const ctx = await requirePermission("plans");
  await syncSuiteLinks(prisma, ctx.org.id);
  const suites = await prisma.testSuite.findMany({
    where: { organisationId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { testCases: true } } },
  });
  const rows: SuiteRow[] = suites.map((suite) => ({
    id: suite.id,
    name: suite.name,
    platform: suite.platform,
    module: suite.module,
    testCasesCount: suite._count.testCases,
    labelsJson: suite.labelsJson,
    lastRunAt: suite.lastRunAt ? suite.lastRunAt.toISOString() : null,
    passRate: suite.passRate,
    createdAt: suite.createdAt.toISOString(),
  }));
  return (
    <div className="space-y-5">
      <PageHeader title="Test Suites" description="View and manage all your test suites." />
      <SuitesClient suites={rows} readOnly={ctx.readOnly} defaultEmail={ctx.user.email} />
    </div>
  );
}
