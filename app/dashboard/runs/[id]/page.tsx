import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import Link from "next/link";
import { RcaExport } from "@/components/dashboard/pages/RcaExport";
import { classifyFailure } from "@/lib/rca";
import { Card, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Execution evidence" };
export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("testCases");
  const { id } = await params;
  const run = await prisma.testRun.findFirst({ where: { id, organisationId: ctx.org.id }, include: { logs: { orderBy: { timestamp: "asc" } } } });
  if (!run) {
    return (
      <div className="space-y-6">
        <PageHeader title="Run not found" description="This execution does not belong to your organisation." />
        <Link href="/dashboard/overview" className="text-sm font-medium text-brand-600 hover:underline">← Back to overview</Link>
      </div>
    );
  }
  const metrics = await prisma.performanceMetric.findMany({ where: { testRunId: run.id } });
  let evidence: Array<{ kind?: string; message?: string; screenshotBase64?: string }> = [];
  try {
    evidence = JSON.parse(run.evidenceJson || "[]");
  } catch {
    evidence = [];
  }
  const rca = classifyFailure(run.logs);
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="EXECUTION EVIDENCE · ROOT CAUSE ANALYSIS"
        title={`Release #${run.release} · v${run.version}`}
        description={`${run.title} · ${run.testsPassed}/${run.testsTotal} passed · ${run.durationMs} ms · ${timeAgo(run.createdAt)}`}
        actions={
          <>
            <StatusPill value={run.status === "SUCCESS" ? "passing" : "failing"} label={run.status} />
            <Link href="/dashboard/overview" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">← Overview</Link>
          </>
        }
      />
      <Card title="Root cause analysis">
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm">
            Classification: <strong>{rca.classification}</strong> · confidence {Math.round(rca.confidence * 100)}%
          </p>
          <p className="text-sm text-slate-600">{rca.explanation}</p>
          <RcaExport runId={run.id} title={run.title} />
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-slate-500">Quality score</p><p className="text-2xl font-semibold">{run.qualityScore}/100</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Coverage</p><p className="text-2xl font-semibold">{run.coverage}%</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Regressions caught</p><p className="text-2xl font-semibold">{run.regressionsCaught}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Cost avoided</p><p className="text-2xl font-semibold">${run.costAvoided.toLocaleString()}</p></Card>
      </div>
      <Card title="Step logs">
        {run.logs.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">No log lines for this run yet.</p> : (
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {run.logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 py-1.5 text-xs">
                <code className="rounded bg-slate-100 px-1.5 py-0.5">{l.tag}</code>
                <span className="text-slate-700">{l.message}</span>
                <span className="ml-auto text-slate-400">{l.stream}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Performance (Web Vitals)">
          <ul className="px-5 py-3">
            {metrics.length === 0 && <li className="py-2 text-sm text-slate-500">No metrics recorded.</li>}
            {metrics.map((m) => (
              <li key={m.id} className="flex justify-between py-1 text-sm"><span className="font-medium">{m.metric}</span><span className={m.passed ? "text-emerald-600" : "text-red-600"}>{m.value} {m.passed ? "✓" : "✕"}</span></li>
            ))}
          </ul>
        </Card>
        <Card title="Evidence artifacts">
          <ul className="px-5 py-3">
            {evidence.length === 0 && <li className="py-2 text-sm text-slate-500">No evidence artifacts (screenshots/traces) for this run.</li>}
            {evidence.map((e, i) => (
              <li key={i} className="py-1 text-xs text-slate-600">{e.kind ?? "artifact"} — {e.message ?? "captured"}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
