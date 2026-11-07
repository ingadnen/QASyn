import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { simulateVitals } from "@/lib/performance-metrics";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Performance" };
export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const ctx = await requireOrgContext();
  const stored = await prisma.performanceMetric.findMany({ where: { testRunId: { in: (await prisma.testRun.findMany({ where: { organisationId: ctx.org.id }, take: 10, select: { id: true } })).map((r) => r.id) } } });
  const vitals = stored.length ? [] : simulateVitals(ctx.org.id);
  const display = stored.length
    ? stored.map((m) => ({ metric: m.metric, value: m.value, threshold: m.threshold, passed: m.passed }))
    : vitals.map((v) => ({ metric: v.metric, value: v.value, threshold: v.threshold, passed: v.passed }));
  return (
    <div className="space-y-6">
      <PageHeader kicker="ANALYTICS" title="Performance" description="Web Vitals capture (LCP, FCP, CLS, TTFB, TTI) with budget validation." />
      <Card title={stored.length ? "Stored metrics" : "Simulated vitals (no stored metrics yet)"}>
        {display.length === 0 ? <EmptyState title="No metrics" description="Run a test plan to capture performance." /> : (
          <ul className="px-5 py-3">
            {display.map((v, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{v.metric}</span>
                <span className="text-xs text-slate-500">budget {v.threshold}</span>
                <span className={v.passed ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>{v.value} {v.passed ? "✓ passed" : "✗ exceeded"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
