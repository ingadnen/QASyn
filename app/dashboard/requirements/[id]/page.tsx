import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequirementDetail, type RequirementDetailData } from "@/components/dashboard/pages/RequirementDetail";
import { prisma } from "@/lib/db";
import { detailCases, longDate } from "@/lib/requirement-detail";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Requirement details" };
export const dynamic = "force-dynamic";

export default async function RequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("requirements");
  const { id } = await params;
  const [requirement, environment] = await Promise.all([
    prisma.requirement.findFirst({
      where: { id, organisationId: ctx.org.id },
      include: { testCases: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.environmentConfig.findFirst({ where: { organisationId: ctx.org.id, isDefault: true }, select: { name: true } }),
  ]);
  if (!requirement) notFound();

  const cases = requirement.testCases.length
    ? requirement.testCases
    : await prisma.testCase.findMany({
        where: { organisationId: ctx.org.id, ...(requirement.coverageStatus === "uncovered" ? {} : { module: requirement.title.split(" ")[0] }) },
        orderBy: { createdAt: "desc" },
        take: requirement.linkedTestsCount || 10,
      });
  const ids = cases.map((c) => c.id);
  const [suite, plan, crawl] = await Promise.all([
    ids.length ? prisma.testSuite.findFirst({ where: { organisationId: ctx.org.id, testCases: { some: { id: { in: ids } } } }, select: { name: true } }) : null,
    ids.length ? prisma.testPlan.findFirst({ where: { organisationId: ctx.org.id, testCases: { some: { id: { in: ids } } } }, select: { name: true } }) : null,
    prisma.crawlSession.findFirst({ where: { organisationId: ctx.org.id, requirementId: requirement.id }, select: { startedAt: true, publishMode: true } }),
  ]);

  const kind = requirement.source === "doc" ? "Doc" : requirement.source === "jira" ? "Jira" : requirement.source === "linear" ? "Linear" : requirement.source === "crawl" ? "Crawl" : "Manual";
  const statusLabel = requirement.coverageStatus === "covered" ? "Completed" : requirement.coverageStatus === "partial" ? "In Progress" : "Pending Action";
  const data: RequirementDetailData = {
    title: requirement.title,
    status: requirement.coverageStatus,
    statusLabel,
    code: requirement.code,
    kind,
    author: ctx.user.name,
    createdAt: longDate(crawl?.startedAt ?? requirement.createdAt),
    publishMode: crawl?.publishMode || "Require approval",
    environment: environment?.name ?? "default_environment",
    suite: suite?.name ?? "Not created",
    plan: plan?.name ?? "Not created",
  };

  return <RequirementDetail data={data} cases={detailCases(cases)} />;
}
