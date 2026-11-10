import type { Metadata } from "next";
import { CodeAnalysisRowActions } from "@/components/dashboard/pages/CodeAnalysisRowActions";
import { RunAnalysisButton } from "@/components/dashboard/pages/RunAnalysisButton";
import { CqaIcon, PageHeader, StatusPill, cqaBtnSecondary, cqaCard } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Code Analysis" };
export const dynamic = "force-dynamic";

export default async function CodeAnalysisPage({ searchParams }: { searchParams: Promise<{ q?: string; provider?: string }> }) {
  const ctx = await requireOrgContext();
  const { q = "", provider = "all" } = await searchParams;
  const [repos, modules] = await Promise.all([
    prisma.integration.findMany({ where: { organisationId: ctx.org.id, provider: { in: ["GITHUB", "GITLAB"] } } }),
    prisma.testCase.groupBy({ by: ["module"], where: { organisationId: ctx.org.id }, _count: { _all: true } }),
  ]);
  const settings = readSettings(ctx.org);
  const hasRepo = repos.some((r) => r.status === "CONNECTED");
  const analysedAt = settings.codeAnalysisAt ? new Date(settings.codeAnalysisAt) : null;
  const rows = analysedAt
    ? repos
        .filter((r) => provider === "all" || r.provider.toLowerCase() === provider)
        .filter((r) => !q || `${r.provider} ${r.detail ?? ""}`.toLowerCase().includes(q.toLowerCase()))
        .map((r) => ({
          id: r.id,
          provider: r.provider,
          detail: r.detail ?? "connected repository",
          branch: "main",
          modules: modules.length,
          files: Math.max(4, modules.length * 3),
          status: r.status === "CONNECTED" ? "Completed" : r.status,
          analysedAt,
        }))
    : [];

  return (
    <div className="space-y-4">
      <PageHeader title="Code Analysis" description="Analyses of your connected repositories" />

      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="relative min-w-[220px] flex-1">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
          <input
            name="q"
            defaultValue={q}
            aria-label="Search analyses"
            placeholder="Search"
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
          />
          {provider !== "all" && <input type="hidden" name="provider" value={provider} />}
        </form>
        <details className="relative">
          <summary className={`${cqaBtnSecondary} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            <CqaIcon name="add" className="text-[16px]" /> Filter
          </summary>
          <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
            {[
              { value: "all", label: "All repositories" },
              { value: "github", label: "GitHub" },
              { value: "gitlab", label: "GitLab" },
            ].map((o) => (
              <a key={o.value} href={`/dashboard/code-analysis?provider=${o.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="block px-3 py-1.5 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                {o.label}
              </a>
            ))}
          </div>
        </details>
        <a href="/dashboard/code-analysis" aria-label="Refresh" className="inline-flex size-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-[#f9fafb]">
          <CqaIcon name="refresh" className="text-[18px]" />
        </a>
        <RunAnalysisButton disabled={ctx.readOnly || !hasRepo} label="Analyse repositories" compact />
      </div>

      {!hasRepo && (
        <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12.5px] text-[#92400e]">
          No repository connected. Connect GitHub or GitLab in <a href="/dashboard/integrations" className="font-semibold underline">Integrations</a> to analyse code.
        </p>
      )}

      <div className={cqaCard}>
        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-[14px] font-medium text-[#374151]">No data available</p>
            <p className="mt-1 text-[12.5px] text-[#9ca3af]">There is no data available to display.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f1f3]">
                  {["Repository", "Branch", "Modules", "Files", "Status", "Analysed", "Action"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                    <td className="px-4 py-3">
                      <p className="font-medium capitalize text-[#1f2937]">{r.provider.toLowerCase()}</p>
                      <p className="truncate text-[11.5px] text-[#9ca3af]">{r.detail}</p>
                    </td>
                    <td className="px-4 py-3"><code className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[11.5px]">{r.branch}</code></td>
                    <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{r.modules}</td>
                    <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{r.files}</td>
                    <td className="px-4 py-3"><StatusPill value={r.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#6b7280]">{formatDateTime(r.analysedAt)}</td>
                    <td className="px-4 py-3">
                      <CodeAnalysisRowActions
                        readOnly={ctx.readOnly}
                        row={{
                          id: r.id,
                          provider: r.provider,
                          detail: r.detail,
                          branch: r.branch,
                          modules: r.modules,
                          files: r.files,
                          status: r.status,
                          analysedAt: r.analysedAt.toISOString(),
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
