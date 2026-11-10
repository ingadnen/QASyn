import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "CI/CD" };
export const dynamic = "force-dynamic";

export default async function CiCdPage() {
  const ctx = await requirePermission("settings");
  const [webhooks, executions] = await Promise.all([
    prisma.webhook.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.testPlanExecution.findMany({ where: { organisationId: ctx.org.id }, orderBy: { startedAt: "desc" }, take: 10 }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader kicker="CI/CD PIPELINES" title="CI/CD" description="Trigger test plans from GitHub Actions, GitLab CI or Jenkins via the inbound webhook, and receive outbound result webhooks." />
      <Card title="Inbound trigger">
        <div className="space-y-2 px-5 py-4 text-sm text-slate-600">
          <p><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">POST /api/webhooks/trigger</code> with <code>Authorization: Bearer cqa_…</code></p>
          <pre className="rounded-lg bg-slate-900 p-3 text-[11px] text-slate-200">{`curl -X POST https://qasyn.local/api/webhooks/trigger \\
  -H "Authorization: Bearer cqa_…" \\
  -H "content-type: application/json" \\
  -d '{"testPlanId":"<plan-id>","triggeredBy":"ci"}'`}</pre>
          <p className="text-xs text-slate-500">Outbound webhooks: {webhooks.length} configured (Settings → Webhooks).</p>
        </div>
      </Card>
      <Card title="Recent triggered executions">
        <ul className="divide-y divide-slate-100 px-5 py-2">
          {executions.length === 0 && <li className="py-3 text-sm text-slate-500">No triggered executions yet.</li>}
          {executions.map((e) => (
            <li key={e.id} className="py-2 text-sm">
              <span className="font-medium">{e.status}</span> <span className="text-xs text-slate-500">via {e.triggeredBy} · {new Date(e.startedAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
