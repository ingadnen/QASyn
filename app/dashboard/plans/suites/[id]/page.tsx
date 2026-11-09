import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuiteDetail } from "@/components/dashboard/pages/SuiteDetail";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Suite detail" };
export const dynamic = "force-dynamic";

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export default async function SuiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const [suite, allSuites, allPlans, allCases] = await Promise.all([
    prisma.testSuite.findFirst({
      where: { id, organisationId: ctx.org.id },
      include: {
        testCases: { orderBy: [{ module: "asc" }, { createdAt: "desc" }] },
        plans: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.testSuite.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" }, select: { id: true } }),
    prisma.testPlan.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "asc" }, select: { id: true } }),
    prisma.testCase.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: [{ module: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, module: true, status: true, lastRunAt: true },
    }),
  ]);
  if (!suite) notFound();

  const suiteIndex = allSuites.findIndex((s) => s.id === suite.id);
  const planCode = new Map(allPlans.map((p, index) => [p.id, `TP-${index + 1}`]));
  const caseCode = new Map(allCases.map((c, index) => [c.id, `TC-${String(allCases.length - index).padStart(3, "0")}`]));

  return (
    <SuiteDetail
      readOnly={ctx.readOnly}
      suite={{
        id: suite.id,
        code: `TS-${suiteIndex + 1}`,
        name: suite.name,
        description: suite.description ?? "",
        schedule: suite.schedule,
        module: suite.module,
        platform: suite.platform,
        labels: parseList(suite.labelsJson),
        prerequisites: parseList(suite.prerequisitesJson),
        passRate: suite.passRate,
        lastRunAt: suite.lastRunAt?.toISOString() ?? null,
        createdAt: suite.createdAt.toISOString(),
      }}
      cases={suite.testCases.map((c) => ({
        id: c.id,
        code: caseCode.get(c.id) ?? "TC-—",
        title: c.title,
        status: c.status,
        module: c.module,
        lastRunAt: c.lastRunAt?.toISOString() ?? null,
      }))}
      plans={suite.plans.map((p) => ({
        id: p.id,
        code: planCode.get(p.id) ?? "TP-—",
        name: p.name,
        platform: suite.platform,
        passRate: p.passRate,
        lastRunAt: p.lastRunAt?.toISOString() ?? null,
      }))}
      allCases={allCases.map((c) => ({ id: c.id, code: caseCode.get(c.id) ?? "TC-—", title: c.title, module: c.module }))}
    />
  );
}
