import type { Metadata } from "next";
import { TestCasesParity, type ParityFolder, type ParityStep } from "@/components/dashboard/pages/TestCasesParity";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";
import { initialsOf } from "@/lib/auth";

export const metadata: Metadata = { title: "Test cases" };
export const dynamic = "force-dynamic";

function parseSteps(raw: string): ParityStep[] {
  try {
    const parsed = JSON.parse(raw || "[]") as Array<Partial<ParityStep>>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((step, index) => ({
      id: String(step.id ?? `s${index + 1}`),
      action: String(step.action ?? "Click"),
      target: String(step.target ?? ""),
      value: String(step.value ?? ""),
      selector: String(step.selector ?? ""),
    }));
  } catch {
    return [];
  }
}

export default async function TestCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; tab?: string }>;
}) {
  const ctx = await requireOrgContext();
  const { new: openNew, tab } = await searchParams;
  const [testCases, components, folderRows] = await Promise.all([
    prisma.testCase.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: [{ module: "asc" }, { createdAt: "desc" }],
      include: { folder: { select: { id: true, name: true } } },
    }),
    prisma.testComponent.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.testFolder.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { testCases: true } } },
    }),
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
    folder: t.folder?.name ?? "",
    folderId: t.folderId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.createdAt.toISOString(),
    lastRunAt: t.lastRunAt?.toISOString() ?? null,
  }));
  const groups = components.map((c) => {
    const steps = parseSteps(c.stepsJson);
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      stepsCount: steps.length,
      createdAt: c.createdAt.toISOString(),
      steps,
    };
  });
  const folders: ParityFolder[] = folderRows.map((folder) => ({
    id: folder.id,
    name: folder.name,
    color: folder.color,
    count: folder._count.testCases,
  }));
  const modules = [...new Set(testCases.map((t) => t.module))].filter(Boolean).sort();
  return (
    <TestCasesParity
      rows={rows}
      groups={groups}
      folders={folders}
      modules={modules.length ? modules : ["Core"]}
      readOnly={ctx.readOnly}
      openNew={openNew === "1"}
      initialTab={tab === "groups" ? "groups" : "cases"}
      userName={ctx.user.name}
    />
  );
}
