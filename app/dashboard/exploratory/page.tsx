import type { Metadata } from "next";
import { Card, EmptyState, PageHeader, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Exploratory" };
export const dynamic = "force-dynamic";

export default async function ExploratoryPage() {
  const ctx = await requireOrgContext();
  const sessions = await prisma.exploratorySession.findMany({ where: { organisationId: ctx.org.id }, orderBy: { startedAt: "desc" }, take: 30 });
  return (
    <div className="space-y-6">
      <PageHeader kicker="TESTING STUDIO" title="Exploratory" description="Capture unstructured exploratory actions and convert them into reusable NLP test scripts. (Capture via POST /api/dashboard/exploratory.)" />
      <Card title={`${sessions.length} sessions`}>
        {sessions.length === 0 ? <EmptyState title="No sessions" description="Capture a session via the recorder, then convert it here." /> : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((s) => {
              let count = 0;
              try {
                count = (JSON.parse(s.actionsJson || "[]") as unknown[]).length;
              } catch {
                count = 0;
              }
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{count} actions · {s.status}</p>
                    <p className="text-xs text-slate-500">started {timeAgo(s.startedAt)}{s.convertedCaseId ? " · converted" : ""}</p>
                  </div>
                  {s.status !== "converted" && <ActionButton url={`/api/dashboard/exploratory/${s.id}/convert`} json={{ convert: true }} disabled={ctx.readOnly || count === 0}>Convert to Test Case</ActionButton>}
                  {s.convertedCaseId && <a href={`/dashboard/test-cases/${s.convertedCaseId}`} className="text-xs font-semibold text-brand-600 hover:underline">Open test case →</a>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
