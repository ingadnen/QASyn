import type { Metadata } from "next";
import { StudioClient, type StudioStep } from "@/components/dashboard/pages/StudioClient";
import { Card, PageHeader, StatusPill } from "@/components/dashboard/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Test Studio" };
export const dynamic = "force-dynamic";

/** Full IDE-like visual editor: step list + inspector, drag reorder, components, auto-save. */
export default async function TestStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const tc = await prisma.testCase.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!tc) notFound();
  let steps: StudioStep[] = [];
  try {
    steps = JSON.parse(tc.stepsJson || "[]");
  } catch {
    steps = [];
  }
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="TESTING STUDIO · VISUAL EDITOR"
        title={`Test Studio — ${tc.title}`}
        description="Drag-reorder steps, edit inline, insert reusable components, auto-save stepsJson. Use ↑/↓ to reorder, plus for templates."
        actions={
          <>
            <StatusPill value={tc.status} />
            <Link href="/dashboard/test-cases" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">← All test cases</Link>
          </>
        }
      />
      <StudioClient testCaseId={tc.id} initialSteps={steps} readOnly={ctx.readOnly} />
      <RunsHistory organisationId={ctx.org.id} />
    </div>
  );
}

async function RunsHistory({ organisationId }: { organisationId: string }) {
  const runs = await prisma.testRun.findMany({ where: { organisationId }, orderBy: { createdAt: "desc" }, take: 5 });
  return (
    <Card title="Run History">
      {runs.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">No runs yet — hit Run Test above.</p>
      ) : (
        <ul className="divide-y divide-slate-100 px-5 py-2">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className={r.status === "SUCCESS" ? "text-emerald-600" : "text-red-600"}>{r.status === "SUCCESS" ? "✓" : "❌"}</span>
              <span className="font-medium">Release #{r.release}</span>
              <span className="text-xs text-slate-500">{r.testsPassed}/{r.testsTotal} passed · {r.durationMs} ms · {r.status}</span>
              <Link href={`/dashboard/runs/${r.id}`} className="ml-auto text-xs font-semibold text-brand-600 hover:underline">View evidence →</Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
