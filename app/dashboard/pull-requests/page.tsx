import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { PullRequestsBoard } from "@/components/dashboard/pages/PullRequestsBoard";
import { CqaIcon, PageHeader, cqaBtnSecondary, cqaCard } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { prDetail } from "@/lib/pr-catalog";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "PR Impact Analysis" };
export const dynamic = "force-dynamic";

export default async function PullRequestsPage({ searchParams }: { searchParams: Promise<{ q?: string; risk?: string }> }) {
  const ctx = await requirePermission("pullRequests");
  const { q = "", risk = "all" } = await searchParams;
  const [allPrs, repo] = await Promise.all([
    prisma.pullRequestCheck.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.integration.findFirst({
      where: { organisationId: ctx.org.id, provider: { in: ["GITHUB", "GITLAB", "BITBUCKET", "AZURE_DEVOPS"] }, status: "CONNECTED" },
    }),
  ]);
  const environments = await prisma.environmentConfig.findMany({
    where: { organisationId: ctx.org.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, baseUrl: true, isDefault: true },
  });
  const prs = allPrs.filter((pr) => {
    if (risk !== "all" && pr.riskLevel !== risk) return false;
    if (q && !`${pr.title} ${pr.branch} ${pr.author} #${pr.prNumber}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const nextNumber = (allPrs.reduce((max, pr) => Math.max(max, pr.prNumber), 0) || 100) + 1;

  return (
    <div className="space-y-4">
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
            ].map((option) => (
              <a
                key={option.value}
                href={`/dashboard/pull-requests?risk=${option.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="block px-3 py-1.5 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]"
              >
                {option.label}
              </a>
            ))}
          </div>
        </details>
        <a
          href="/dashboard/pull-requests"
          aria-label="Refresh"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-[#f9fafb]"
        >
          <CqaIcon name="refresh" className="text-[18px]" />
        </a>
      </div>

      {!repo && (
        <p className={`${cqaCard} px-3 py-2 text-[12.5px] text-[#92400e]`}>
          Connect GitHub, GitLab, Bitbucket or Azure DevOps in{" "}
          <a href="/dashboard/integrations" className="font-semibold underline">
            Integrations
          </a>{" "}
          to select real open pull requests. Manual / custom PR URLs remain available.
        </p>
      )}

      <PullRequestsBoard initialRows={prs.map(prDetail)} readOnly={ctx.readOnly} nextNumber={nextNumber} environments={environments} />

      {prs.length > 0 && (
        <p className="text-[12px] text-[#6b7280]">
          1–{prs.length} of {prs.length} pull requests
        </p>
      )}
    </div>
  );
}
