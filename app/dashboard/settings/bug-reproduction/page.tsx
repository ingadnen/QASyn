import type { Metadata } from "next";
import { BugReproForm } from "@/components/dashboard/pages/Forms";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Bug reproduction settings" };
export const dynamic = "force-dynamic";

export default async function BugReproSettingsPage() {
  const ctx = await requireOrgContext();
  const initial = readSettings(ctx.org).bugReproduction ?? { autoReproduce: true, sources: ["jira", "linear"], captureVideo: true, captureNetwork: true, captureConsole: true, maxAttempts: 3 };
  const bugs = await prisma.bugReport.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 20 });
  const tracker = await prisma.integration.findFirst({ where: { organisationId: ctx.org.id, provider: { in: ["JIRA", "LINEAR"] }, status: "CONNECTED" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="SETTINGS" title="Bug reproduction" description="Automatic reproduction from Jira/Linear with video and network traces." />
      {!tracker && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Connect Jira or Linear in <a href="/dashboard/integrations" className="font-semibold underline">Integrations</a> to auto-reproduce new tickets.
        </p>
      )}
      <Card title="Reproduction"><div className="px-5 py-4"><BugReproForm initial={initial} readOnly={ctx.readOnly} /></div></Card>
      <Card title="Recent bug reports">
        <ul className="divide-y divide-slate-100 px-5 py-2">
          {bugs.length === 0 && <li className="py-3 text-sm text-slate-500">No bug reports yet.</li>}
          {bugs.map((b) => (
            <li key={b.id} className="py-2">
              <p className="text-sm font-medium text-slate-800">{b.title} <span className="text-xs text-slate-400">· {b.severity} · {b.status}{b.externalKey ? ` · ${b.externalKey}` : ""}</span></p>
              {b.rootCause && <p className="text-xs text-slate-500">Root cause: {b.rootCause}</p>}
              {b.reproductionSteps && <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{b.reproductionSteps}</pre>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
