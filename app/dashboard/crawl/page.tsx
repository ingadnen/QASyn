import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { CrawlTable, type CrawlRow } from "@/components/dashboard/pages/CrawlTable";
import { NewCrawlButton } from "@/components/dashboard/pages/NewCrawlButton";
import { AutopilotButton } from "@/components/dashboard/pages/AutopilotButton";
import { PageHeader } from "@/components/dashboard/ui";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Crawl" };
export const dynamic = "force-dynamic";

export default async function CrawlPage() {
  const ctx = await requirePermission("crawl");
  const [crawls, requirements, plans] = await Promise.all([
    prisma.crawlSession.findMany({ where: { organisationId: ctx.org.id }, orderBy: { startedAt: "desc" } }),
    prisma.requirement.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, code: true, linkedTestsCount: true, createdAt: true } }),
    prisma.testPlan.findMany({ where: { organisationId: ctx.org.id }, select: { name: true } }),
  ]);
  const reqById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const rows: CrawlRow[] = crawls.map((crawl, index) => {
    const linked = crawl.requirementId ? reqById.get(crawl.requirementId) : undefined;
    return {
      id: crawl.id,
      code: linked?.code ?? `CRL-${String(crawls.length - index).padStart(3, "0")}`,
      name: crawl.explorePrompt?.trim() || `${formatDateTime(crawl.startedAt).replace(/[:\s]/g, "-")}_crawl`,
      plan: crawl.createPlan ? plans[0]?.name ?? "-" : "-",
      status: crawl.status,
      cases: linked?.linkedTestsCount ?? crawl.flowsMapped,
      createdBy: ctx.user.name,
      createdAt: crawl.startedAt.toISOString(),
      targetUrl: crawl.targetUrl,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Crawl" description="Every crawl of your application and the test cases it produced" />
      <CrawlTable
        rows={rows}
        readOnly={ctx.readOnly}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AutopilotButton defaultTarget={ctx.org.website ?? "https://www.cgi.com"} readOnly={ctx.readOnly} variant="secondary" />
            <NewCrawlButton defaultUrl={ctx.org.website ?? ""} readOnly={ctx.readOnly} />
          </div>
        }
      />
    </div>
  );
}
