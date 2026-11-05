import type { Metadata } from "next";
import Link from "next/link";
import { AQETerminal } from "@/components/sections/dashboard/AQETerminal";
import { CostSavingsChart, QualityTrendChart } from "@/components/sections/dashboard/Charts";
import { ReleaseQualityCard } from "@/components/sections/dashboard/ReleaseQualityCard";
import { RunsTable } from "@/components/sections/dashboard/RunsTable";
import { StatCards } from "@/components/sections/dashboard/StatCards";
import { Badge } from "@/components/ui/Badge";
import { getOverview, resolveDashboardOrg } from "@/lib/dashboard";
import { capitalize } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

/**
 * Cible E — /dashboard/overview
 * Server Component : statistiques, graphiques, journal des runs et logs AQE
 * lus directement depuis SQLite (TestRun + LogLine).
 */
export default async function OverviewPage() {
  const dashboard = await resolveDashboardOrg();

  if (!dashboard) {
    return (
      <EmptyState
        title="No data yet"
        body="Seed the local database with `npm run db:seed`, or create an organisation and finish onboarding."
      />
    );
  }

  const { org, isDemo, pendingOrg } = dashboard;
  const { runs, latestLogs, totals } = await getOverview(org.id);
  const latest = runs.at(-1);

  if (!latest) {
    return <EmptyState title="No releases analysed yet" body="Finish onboarding to launch Ship's first analysis." />;
  }

  const previous = runs.at(-2) ?? null;
  const project = isDemo ? "acme / storefront" : `${org.slug} / app`;

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{capitalize(org.name)} workspace</h1>
            {isDemo && <Badge tone="brand">Demo data</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {totals.runs} releases · {totals.failedRuns} blocked · {totals.passRate.toFixed(1)}% test pass rate ·{" "}
            {totals.anomaliesReproduced} production anomalies reproduced
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="success" dot pulse>
            Ship watching
          </Badge>
          <Link
            href="/onboard/organisation"
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-500"
          >
            New organisation
          </Link>
        </div>
      </header>

      {pendingOrg && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm">
          <p className="text-brand-800">
            <span className="font-semibold">{capitalize(pendingOrg.name)}</span> isn&apos;t set up yet — you&apos;re
            viewing demo data.
          </p>
          <Link href="/onboarding" className="font-medium text-brand-700 hover:underline">
            Resume onboarding →
          </Link>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <StatCards latest={latest} previous={previous} totals={totals} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <QualityTrendChart runs={runs} />
            <CostSavingsChart runs={runs} total={totals.costAvoided} />
          </div>
          <ReleaseQualityCard latest={latest} previous={previous} first={runs[0]} />
        </div>

        <AQETerminal
          project={project}
          runs={[...runs].reverse().map(({ id, release, version, status }) => ({ id, release, version, status }))}
          initialRunId={latest.id}
          initialLogs={latestLogs}
        />

        <RunsTable runs={runs} />
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{body}</p>
        <div className="mt-6 flex justify-center gap-3 text-sm">
          <Link href="/onboarding" className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-500">
            Continue onboarding
          </Link>
          <Link href="/onboard/organisation" className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
            New organisation
          </Link>
        </div>
      </div>
    </div>
  );
}
