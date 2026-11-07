import type { Metadata } from "next";
import { ProjectForm } from "@/components/dashboard/pages/StudioClients";
import { Card, EmptyState, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

const TYPE_BADGE: Record<string, string> = { web: "bg-sky-50 text-sky-700", mobile: "bg-purple-50 text-purple-700", api: "bg-amber-50 text-amber-700" };

export default async function ProjectsPage() {
  const ctx = await requireOrgContext();
  const projects = await prisma.project.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { testCases: true, testSuites: true, testPlans: true } } } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="WORKSPACE" title="Projects" description="Multi-project workspaces: each project owns its test cases, suites, plans and crawls." />
      <Card title="New project"><div className="px-5 py-4"><ProjectForm readOnly={ctx.readOnly} /></div></Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 && <EmptyState title="No projects yet" description="Create your first project above." />}
        {projects.map((p) => (
          <Card key={p.id} className={p.archived ? "opacity-60 p-4" : "p-4"}>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">{p.name}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${TYPE_BADGE[p.type] ?? "bg-slate-100 text-slate-600"}`}>{p.type}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{p.description || "—"}</p>
            <p className="mt-2 text-xs text-slate-500">{p._count.testCases} cases · {p._count.testSuites} suites · {p._count.testPlans} plans{p.baseUrl ? ` · ${p.baseUrl}` : ""}</p>
            <div className="mt-3 flex gap-2">
              <ActionButton url={`/api/dashboard/projects/${p.id}`} method="PATCH" json={{ archived: !p.archived }} disabled={ctx.readOnly}>{p.archived ? "Unarchive" : "Archive"}</ActionButton>
              <ActionButton url={`/api/dashboard/projects/${p.id}`} method="DELETE" variant="danger" disabled={ctx.readOnly} confirmText={`Delete project "${p.name}"?`}>Delete</ActionButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
