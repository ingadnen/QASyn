import type { Metadata } from "next";
import { NewRequirementButton } from "@/components/dashboard/pages/NewRequirementButton";
import { CqaIcon, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { PageActions, RowMenu, TableShell, Td, Toolbar, Tr } from "@/components/contextqa/workspace";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Requirements" };
export const dynamic = "force-dynamic";

function libraryStatus(coverageStatus: string): string {
  if (coverageStatus === "covered") return "Completed";
  if (coverageStatus === "partial") return "In Progress";
  return "Pending Action";
}

export default async function RequirementsPage() {
  const ctx = await requireOrgContext();
  const [reqs, crawlRequirements] = await Promise.all([
    prisma.requirement.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      include: { testCases: { select: { id: true } } },
    }),
    prisma.crawlSession.findMany({
      where: { organisationId: ctx.org.id, requirementId: { not: null } },
      select: { requirementId: true },
    }),
  ]);
  const crawlRequirementIds = new Set(crawlRequirements.map((crawl) => crawl.requirementId));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Requirements Library"
        description="Upload requirements, review questionnaires, track test case generation, and manage change history"
      />
      <Toolbar
        searchPlaceholder="Search"
        actions={<PageActions filter primary={<NewRequirementButton readOnly={ctx.readOnly} defaultUrl={ctx.org.website ?? ""} />} />}
      />
      <TableShell
        headers={["", "Name", "Format", "Type", "Test Plan", "Status", "Test Cases", "Created by", "Created Date", "Action"]}
        footer={<span className="tabular-nums">1–{Math.max(reqs.length, 0)} of {Math.max(reqs.length, 0)}</span>}
      >
        {reqs.length === 0 && (
          <tr>
            <td colSpan={10} className="px-4 py-14 text-center">
              <p className="text-[14px] font-medium text-[#374151]">No data available</p>
              <p className="mt-1 text-[12.5px] text-[#9ca3af]">Upload requirements or create one with New Requirement.</p>
            </td>
          </tr>
        )}
        {reqs.map((r) => {
          const linked = r.testCases.length || r.linkedTestsCount;
          const isCrawl = crawlRequirementIds.has(r.id);
          const sourceLabel = r.source === "doc" ? "Doc" : r.source === "jira" ? "Jira" : r.source === "linear" ? "Linear" : r.source === "import" ? "Import" : r.source === "crawl" ? "Crawl" : "Manual";
          return (
            <Tr key={r.id}>
              <Td className="w-8 pr-0">
                <input type="checkbox" aria-label={`Select ${r.code}`} className="size-3.5 rounded border-[#d1d5db] accent-[#5b4ee8]" />
              </Td>
              <Td>
                <p className="text-[10px] font-medium text-[#9ca3af]">{r.code}</p>
                <a href={`/dashboard/requirements/${r.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{r.title}</a>
              </Td>
              <Td>
                <span className="inline-flex items-center rounded bg-[#f3f4f6] px-2 py-0.5 text-[11.5px] font-medium text-[#374151]">
                  {isCrawl ? "Auto Crawl" : sourceLabel}
                </span>
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1.5 text-[#4b5563]">
                  <CqaIcon name={isCrawl ? "language" : "description"} className="text-[16px] text-[#6b7280]" />
                  <span>{isCrawl ? "Crawl" : sourceLabel}</span>
                </span>
              </Td>
              <Td className="text-[#4b5563]">-</Td>
              <Td><StatusPill value={r.coverageStatus} label={libraryStatus(r.coverageStatus)} /></Td>
              <Td>
                <span className="font-semibold text-[#1f2937]">{linked}</span> <span className="text-[#6b7280]">Linked</span>
              </Td>
              <Td className="whitespace-nowrap text-[#4b5563]">{ctx.user.name}</Td>
              <Td className="whitespace-nowrap text-[#6b7280]">{formatDateTime(r.createdAt)}</Td>
              <Td>
                <RowMenu
                  items={[
                    { label: "View Details", icon: "visibility", href: `/dashboard/requirements/${r.id}` },
                    { label: "Download Original", icon: "download" },
                    { label: "Export Test Cases", icon: "upload" },
                    { label: "Re-import / Update", icon: "sync" },
                    { label: "Delete", icon: "delete", danger: true },
                  ]}
                />
              </Td>
            </Tr>
          );
        })}
      </TableShell>
    </div>
  );
}
