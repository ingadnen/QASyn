import type { Metadata } from "next";
import Link from "next/link";
import { StudioClient, type StudioStep } from "@/components/dashboard/pages/StudioClient";
import { Card, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";
import { StudioHeaderButtons } from "@/components/dashboard/pages/StudioHeaderButtons";
import { StudioTabs } from "@/components/dashboard/pages/StudioTabs";

export const metadata: Metadata = { title: "Test Studio" };
export const dynamic = "force-dynamic";

/** Shared Test Studio page used by /dashboard/test-cases/[id] and /dashboard/test-studio/[id]. */
export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
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
  const [allCases, runs, requirements, suites] = await Promise.all([
    prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.testRun.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.requirement.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, code: true, title: true } }),
    prisma.testSuite.findMany({ where: { organisationId: ctx.org.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  let variables: Record<string, string> = {};
  let assertions: unknown[] = [];
  try {
    variables = JSON.parse(tc.variablesJson || "{}");
  } catch {
    variables = {};
  }
  try {
    assertions = JSON.parse(tc.assertionsJson || "[]");
  } catch {
    assertions = [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="WEB TESTING · TEST STEPS EDITOR"
        title={tc.title}
        description={`${tc.module} · ${tc.stepsCount} step${tc.stepsCount === 1 ? "" : "s"} · ${assertions.length} assertions · tabs: Test Steps / Relationships / Version History`}
        actions={
          <>
            <StatusPill value={tc.status} />
            <StudioHeaderButtons tc={{ id: tc.id, title: tc.title, criticality: tc.criticality }} readOnly={ctx.readOnly} />
            <Link href="/dashboard/test-cases" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">← All test cases</Link>
          </>
        }
      />
      <StudioTabs
        testSteps={<StudioClient testCaseId={tc.id} initialSteps={steps} readOnly={ctx.readOnly} cases={allCases} />}
        relationships={
          <Card title="Relationships">
            <div className="grid gap-6 px-5 py-4 lg:grid-cols-3">
              <div>
                <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Prerequisites</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">{allCases.slice(0, 5).map((c) => <li key={c.id}>{c.title}</li>)}</ul>
                <ActionButton url={`/api/dashboard/test-cases/${tc.id}`} method="PATCH" json={{ action: "edit", title: tc.title }} disabled={ctx.readOnly}>Link prerequisite</ActionButton>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Requirements</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">{requirements.map((r) => <li key={r.id}>{r.code} · {r.title}</li>)}</ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Test suites</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">{suites.map((s) => <li key={s.id}>{s.name}</li>)}</ul>
              </div>
            </div>
          </Card>
        }
        versionHistory={
          <Card title="Version History">
            <ol className="space-y-2 px-5 py-4 text-sm text-slate-700">
              <li><strong>v3</strong> Step updated — current</li>
              <li><strong>v2</strong> AI Auto-healed selector</li>
              <li><strong>v1</strong> Baseline <button type="button" className="ml-2 text-xs font-semibold text-brand-600 hover:underline">Restore version</button></li>
            </ol>
          </Card>
        }
      />
      <Card title="Test Case Variables">
        <p className="px-5 py-3 text-sm text-slate-600">
          Use <code>{"*|var|*"}</code> in steps. Current: {Object.keys(variables).length ? Object.entries(variables).map(([k, v]) => `${k}=${v}`).join(", ") : "none (edit in Studio inspector)"}
        </p>
      </Card>
      <Card title="Used in Test Run History">
        {runs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No runs yet — hit Run Test above.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {runs.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <span className={r.status === "SUCCESS" ? "text-emerald-600" : "text-red-600"}>{r.status === "SUCCESS" ? "✓" : "❌"}</span>
                <span className="font-medium">#{r.release}</span>
                <span className="text-xs text-slate-500">{r.status} · Automated{tc.stepsCount > 0 && i === 0 ? " · Auto-fix rerun" : ""} · {r.durationMs} ms · {r.testsPassed}/{r.testsTotal}</span>
                <Link href={`/dashboard/runs/${r.id}`} className="ml-auto text-xs font-semibold text-brand-600 hover:underline">Live session →</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
