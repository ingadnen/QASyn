import type { Metadata } from "next";
import { TestCasesParity } from "@/components/dashboard/pages/TestCasesParity";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";
import { initialsOf } from "@/lib/auth";

export const metadata: Metadata = { title: "Test cases" };
export const dynamic = "force-dynamic";

export default async function TestCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; tab?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { new: openNew, tab } = await searchParams;
  const [testCases, components] = await Promise.all([
    prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: [{ module: "asc" }, { createdAt: "desc" }] }),
    prisma.testComponent.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const createdBy = ctx.user.name || initialsOf(ctx.user.name, ctx.user.email);
  const rows = testCases.map((t, index) => ({
    id: t.id,
    code: `TC-${String(testCases.length - index).padStart(3, "0")}`,
    title: t.title,
    module: t.module,
    criticality: t.criticality,
    status: t.status,
    stepsCount: t.stepsCount,
    source: t.source,
    labels: [t.source === "crawl" ? "crawl" : t.source === "ai" ? "ai generated" : "manual", t.module.toLowerCase()],
    createdBy,
    folder: t.module,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.createdAt.toISOString(),
    lastRunAt: t.lastRunAt?.toISOString() ?? null,
  }));
  const groups = components.map((c) => {
    let count = 0;
    try {
      count = (JSON.parse(c.stepsJson || "[]") as unknown[]).length;
    } catch {
      count = 0;
    }
    return { id: c.id, name: c.name, description: c.description, stepsCount: count, createdAt: c.createdAt.toISOString() };
  });
  const modules = [...new Set(testCases.map((t) => t.module))].filter(Boolean).sort();
  return (
    <TestCasesParity
      rows={rows}
      groups={groups}
      modules={modules.length ? modules : ["Core"]}
      readOnly={ctx.readOnly}
      openNew={openNew === "1"}
      initialTab={tab === "groups" ? "groups" : "cases"}
      userName={ctx.user.name}
    />
  );
}
