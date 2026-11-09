import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequirementDetail, type RequirementDetailData } from "@/components/dashboard/pages/RequirementDetail";
import { prisma } from "@/lib/db";
import { detailCases, longDate } from "@/lib/requirement-detail";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Crawl details" };
export const dynamic = "force-dynamic";

export default async function CrawlDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const [crawl, crawls, environment] = await Promise.all([
    prisma.crawlSession.findFirst({ where: { id, organisationId: ctx.org.id } }),
    prisma.crawlSession.findMany({ where: { organisationId: ctx.org.id }, orderBy: { startedAt: "desc" }, select: { id: true } }),
    prisma.environmentConfig.findFirst({ where: { organisationId: ctx.org.id, isDefault: true }, select: { name: true } }),
  ]);
  if (!crawl) notFound();

  const index = crawls.findIndex((c) => c.id === crawl.id);
  const derivedCode = `REQ-${String(Math.max(crawls.length - index, 1)).padStart(3, "0")}`;
  const requirementInclude = { testCases: { orderBy: { createdAt: "desc" as const } } };
  const requirement =
    (crawl.requirementId
      ? await prisma.requirement.findFirst({ where: { id: crawl.requirementId, organisationId: ctx.org.id }, include: requirementInclude })
      : null) ??
    (await prisma.requirement.findFirst({ where: { organisationId: ctx.org.id, code: derivedCode }, include: requirementInclude }));
  const linked = requirement?.testCases?.length
    ? requirement.testCases
    : await prisma.testCase.findMany({ where: { organisationId: ctx.org.id, source: "crawl" }, orderBy: { createdAt: "desc" } });
  const cases = linked.length ? linked : await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: Math.max(crawl.flowsMapped, 5) });

  const ids = cases.map((c) => c.id);
  const [suite, plan] = ids.length
    ? await Promise.all([
        prisma.testSuite.findFirst({ where: { organisationId: ctx.org.id, testCases: { some: { id: { in: ids } } } }, select: { name: true } }),
        prisma.testPlan.findFirst({ where: { organisationId: ctx.org.id, testCases: { some: { id: { in: ids } } } }, select: { name: true } }),
      ])
    : [null, null];

  const statusLabel = crawl.status === "completed" ? "Completed" : crawl.status === "failed" ? "Failed" : "In Progress";
  const data: RequirementDetailData = {
    title: crawl.explorePrompt?.trim() || `${crawlTitle(crawl.targetUrl, crawl.startedAt)}`,
    status: crawl.status,
    statusLabel,
    code: requirement?.code ?? derivedCode,
    kind: "Crawl",
    author: ctx.user.name,
    createdAt: longDate(crawl.startedAt),
    publishMode: crawl.publishMode || "Require approval",
    environment: environment?.name ?? "default_environment",
    suite: suite?.name ?? "Not created",
    plan: plan?.name ?? "Not created",
  };

  return <RequirementDetail data={data} cases={detailCases(cases)} />;
}

function crawlTitle(targetUrl: string, startedAt: Date) {
  const stamp = startedAt
    .toLocaleString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .replace(/[:\s]/g, "-");
  const host = targetUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").split(".")[0] || "crawl";
  return `${stamp.slice(0, 19)}_${host} Crawl`.replace("--", "-");
}
