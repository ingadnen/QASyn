import type { Metadata } from "next";
import { SimulatePrButton } from "@/components/dashboard/pages/PullRequestsClient";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { CqaIcon, PageHeader, StatusPill, cqaBtnPrimary, cqaBtnSecondary, cqaCard } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "PR Impact Analysis" };
export const dynamic = "force-dynamic";

export default async function PullRequestsPage({ searchParams }: { searchParams: Promise<{ q?: string; risk?: string }> }) {
  const ctx = await requireOrgContext();
  const { q = "", risk = "all" } = await searchParams;
  const [allPrs, repo] = await Promise.all([
    prisma.pullRequestCheck.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.integration.findFirst({ where: { organisationId: ctx.org.id, provider: { in: ["GITHUB", "GITLAB"] }, status: "CONNECTED" } }),
  ]);
  const prs = allPrs.filter((p) => {
    if (risk !== "all" && p.riskLevel !== risk) return false;
    if (q && !`${p.title} ${p.branch} ${p.author} #${p.prNumber}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const running = allPrs.some((p) => p.status === "running");
  const nextNumber = (allPrs.reduce((m, p) => Math.max(m, p.prNumber), 0) || 100) + 1;

  return (
    <div className="space-y-4">
      {running && <AutoRefresh intervalMs={3000} />}
      <PageHeader title="PR Impact Analysis" description="Pull requests analysed for impact, and the tests drafted for them" />

      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="relative min-w-[220px] flex-1">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
          <input
            name="q"
            defaultValue={q}
            aria-label="Search pull requests"
            placeholder="Search"
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
          />
          {risk !== "all" && <input type="hidden" name="risk" value={risk} />}
        </form>
        <details className="relative">
          <summary className={`${cqaBtnSecondary} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            <CqaIcon name="add" className="text-[16px]" /> Filter
          </summary>
          <div className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
            {[
              { value: "all", label: "All risk levels" },
              { value: "low", label: "Low risk" },
              { value: "medium", label: "Medium risk" },
              { value: "high", label: "High risk" },
            ].map((o) => (
              <a key={o.value} href={`/dashboard/pull-requests?risk=${o.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="block px-3 py-1.5 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                {o.label}
              </a>
            ))}
          </div>
        </details>
        <a href="/dashboard/pull-requests" aria-label="Refresh" className="inline-flex size-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-[#f9fafb]">
          <CqaIcon name="refresh" className="text-[18px]" />
        </a>
        <SimulatePrButton readOnly={ctx.readOnly} nextNumber={nextNumber} hasRepo={Boolean(repo)} compact />
      </div>

      {!repo && (
        <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12.5px] text-[#92400e]">
          Connect GitHub or GitLab in <a href="/dashboard/integrations" className="font-semibold underline">Integrations</a> to receive PR checks automatically on every push. Simulations remain available.
        </p>
      )}

      <div className={cqaCard}>
        {prs.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-[14px] font-medium text-[#374151]">No data available</p>
            <p className="mt-1 text-[12.5px] text-[#9ca3af]">There is no data available to display.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f1f3]">
                  {["Pull request", "Risk", "Files", "Tests run", "Verdict", "Opened", "Action"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prs.map((p) => (
                  <tr key={p.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                    <td className="max-w-[380px] px-4 py-3">
                      <p className="truncate font-medium text-[#1f2937]">#{p.prNumber} {p.title}</p>
                      <p className="truncate font-mono text-[11.5px] text-[#9ca3af]">{p.branch} · @{p.author}</p>
                    </td>
                    <td className="px-4 py-3"><StatusPill value={p.riskLevel} label={`${p.riskLevel.charAt(0).toUpperCase()}${p.riskLevel.slice(1)}`} /></td>
                    <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{p.filesChanged}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{p.status === "running" ? "…" : p.testsRun}</td>
                    <td className="px-4 py-3">
                      <StatusPill
                        value={p.status}
                        label={p.status === "running" ? "Analysing" : p.status === "regression_caught" ? `${p.regressions} regression${p.regressions === 1 ? "" : "s"} caught` : "Passed baseline"}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#6b7280]">{formatDateTime(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <details className="relative">
                        <summary aria-label="More actions" className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6] [&::-webkit-details-marker]:hidden">
                          <CqaIcon name="more_horiz" className="text-[20px]" />
                        </summary>
                        <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                          <button type="button" className="block w-full px-3 py-1.5 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">View details</button>
                          <button type="button" className="block w-full px-3 py-1.5 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">Re-run analysis</button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {prs.length > 0 && (
        <p className="text-[12px] text-[#6b7280]">1–{prs.length} of {prs.length} pull requests</p>
      )}
    </div>
  );
}
