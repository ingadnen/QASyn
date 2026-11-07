import type { Metadata } from "next";
import { Card, EmptyState, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Visual testing" };
export const dynamic = "force-dynamic";

export default async function VisualTestingPage() {
  const ctx = await requireOrgContext();
  const baselines = await prisma.visualBaseline.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, include: { diffs: true } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="TESTING STUDIO" title="Visual testing" description="Baseline gallery and diff review: pending diffs need approval (threshold ≤ 1% auto-approved, > 5% auto-rejected)." />
      <Card title={`${baselines.length} baselines`}>
        {baselines.length === 0 ? <EmptyState title="No baselines" description="Baselines are captured when a visual step runs with a screenshot." /> : (
          <ul className="divide-y divide-slate-100">
            {baselines.map((b) => (
              <li key={b.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-slate-500">{b.pixelHash}</span>
                  <span className="text-sm text-slate-700">step {b.stepIndex + 1} · {timeAgo(b.createdAt)}</span>
                  <StatusPill value={b.status === "approved" ? "passing" : b.status === "rejected" ? "failing" : "draft"} label={b.status} />
                </div>
                {b.diffs.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {b.diffs.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        mismatch {d.mismatchPercent}% · <StatusPill value={d.status === "approved" ? "passing" : d.status === "rejected" ? "failing" : "draft"} label={d.status} />
                        {d.status === "pending" && (
                          <>
                            <ActionButton url={`/api/dashboard/visual-diffs/${d.id}/approve`} json={{ decision: "approved" }} disabled={ctx.readOnly}>Approve</ActionButton>
                            <ActionButton url={`/api/dashboard/visual-diffs/${d.id}/approve`} json={{ decision: "rejected" }} variant="danger" disabled={ctx.readOnly}>Reject</ActionButton>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
