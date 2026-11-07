import type { Metadata } from "next";
import { SimulatePrButton } from "@/components/dashboard/pages/PullRequestsClient";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { formatDate, tableCls } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Pull requests" };
export const dynamic = "force-dynamic";

export default async function PullRequestsPage() {
  const ctx = await requireOrgContext();
  const [prs, repo] = await Promise.all([
    prisma.pullRequestCheck.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.integration.findFirst({ where: { organisationId: ctx.org.id, provider: { in: ["GITHUB", "GITLAB"] }, status: "CONNECTED" } }),
  ]);
  const running = prs.some((p) => p.status === "running");
  const caught = prs.filter((p) => p.status === "regression_caught").length;
  const nextNumber = (prs.reduce((m, p) => Math.max(m, p.prNumber), 0) || 100) + 1;

  return (
    <div className="space-y-6">
      {running && <AutoRefresh intervalMs={3000} />}
      <PageHeader
        kicker="AUTONOMOUS SDLC"
        title="Pull requests"
        description="Every pull request gets an impact analysis, targeted regression tests and a verdict before merge."
        actions={<SimulatePrButton readOnly={ctx.readOnly} nextNumber={nextNumber} hasRepo={Boolean(repo)} />}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Checked</p>
          <p className="text-2xl font-semibold text-slate-900">{prs.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Regressions caught</p>
          <p className="text-2xl font-semibold text-red-600">{caught}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Repository</p>
          <p className="truncate text-sm font-medium text-slate-900">{repo ? `${repo.provider.toLowerCase()} · ${repo.detail ?? "connected"}` : "Not connected"}</p>
        </Card>
      </div>
      <Card>
        {prs.length === 0 ? (
          <EmptyState title="No pull requests checked yet" description="Simulate a pull request to see impact analysis and regression detection." />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead>
                <tr>
                  <th className={tableCls.th}>Pull request</th>
                  <th className={tableCls.th}>Risk</th>
                  <th className={tableCls.th}>Files</th>
                  <th className={tableCls.th}>Tests run</th>
                  <th className={tableCls.th}>Verdict</th>
                  <th className={tableCls.th}>Opened</th>
                </tr>
              </thead>
              <tbody>
                {prs.map((p) => (
                  <tr key={p.id} className={tableCls.tr}>
                    <td className={tableCls.td}>
                      <p className="font-medium text-slate-900">
                        #{p.prNumber} {p.title}
                      </p>
                      <p className="font-mono text-xs text-slate-400">
                        {p.branch} · @{p.author}
                      </p>
                    </td>
                    <td className={tableCls.td}>
                      <StatusPill value={p.riskLevel} label={`${p.riskLevel} risk`} />
                    </td>
                    <td className={tableCls.td}>{p.filesChanged}</td>
                    <td className={tableCls.td}>{p.status === "running" ? "…" : p.testsRun}</td>
                    <td className={tableCls.td}>
                      <StatusPill
                        value={p.status}
                        label={p.status === "running" ? "analysing" : p.status === "regression_caught" ? `${p.regressions} regression${p.regressions === 1 ? "" : "s"} caught` : "passed baseline"}
                      />
                    </td>
                    <td className={`${tableCls.td} text-xs text-slate-500`}>{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
