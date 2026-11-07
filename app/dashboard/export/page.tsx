import type { Metadata } from "next";
import { ExportForm } from "@/components/dashboard/pages/StudioClients";
import { Card, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Code export" };
export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const ctx = await requireOrgContext();
  const cases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: { title: "asc" }, select: { id: true, title: true } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="WORK" title="Code export" description="Generate Playwright, Selenium, Cypress or WebdriverIO code (with Page Objects + config) from your NLP test cases." />
      <Card title="Export">
        {cases.length === 0 ? <EmptyState title="No test cases" description="Create test cases first." /> : (
          <div className="px-5 py-4"><ExportForm cases={cases} readOnly={ctx.readOnly} /></div>
        )}
      </Card>
    </div>
  );
}
