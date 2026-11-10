import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { NewRequirementButton } from "@/components/dashboard/pages/NewRequirementButton";
import { RequirementsTable, type RequirementRow } from "@/components/dashboard/pages/RequirementsTable";
import { PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Requirements" };
export const dynamic = "force-dynamic";

export default async function RequirementsPage() {
  const ctx = await requirePermission("requirements");
  const [reqs, crawlRequirements, testCases] = await Promise.all([
    prisma.requirement.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      include: { testCases: { select: { id: true } } },
    }),
    prisma.crawlSession.findMany({
      where: { organisationId: ctx.org.id, requirementId: { not: null } },
      select: { requirementId: true },
    }),
    prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  const crawlRequirementIds = new Set(crawlRequirements.map((crawl) => crawl.requirementId));

  const rows: RequirementRow[] = reqs.map((requirement) => {
    const isCrawl = crawlRequirementIds.has(requirement.id);
    const sourceLabel = isCrawl
      ? "Crawl"
      : requirement.source === "doc"
        ? "Doc"
        : requirement.source === "jira"
          ? "Jira"
          : requirement.source === "linear"
            ? "Linear"
            : requirement.source === "import"
              ? "Import"
              : requirement.source === "crawl"
                ? "Crawl"
                : "Manual";
    return {
      id: requirement.id,
      code: requirement.code,
      title: requirement.title,
      sourceLabel,
      isCrawl,
      coverageStatus: requirement.coverageStatus,
      linked: requirement.testCases.length || requirement.linkedTestsCount,
      linkedIds: requirement.testCases.map((testCase) => testCase.id),
      createdBy: ctx.user.name,
      createdAt: requirement.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Requirements Library"
        description="Upload requirements, review questionnaires, track test case generation, and manage change history"
      />
      <RequirementsTable
        rows={rows}
        testCases={testCases}
        readOnly={ctx.readOnly}
        actions={<NewRequirementButton readOnly={ctx.readOnly} defaultUrl={ctx.org.website ?? ""} />}
      />
    </div>
  );
}
