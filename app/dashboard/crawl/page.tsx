import type { Metadata } from "next";
import { NewCrawlButton } from "@/components/dashboard/pages/NewCrawlButton";
import { PageHeader, StatusPill } from "@/components/dashboard/ui";
import { CqaIcon } from "@/components/dashboard/ui";
import { MetaRow, PageActions, RowMenu, TableShell, Td, Toolbar, Tr } from "@/components/contextqa/workspace";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Crawl" };
export const dynamic = "force-dynamic";

function crawlStatus(status: string): string {
  if (status === "running") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Pending Action";
}

export default async function CrawlPage() {
  const ctx = await requireOrgContext();
  const [crawls, requirements, plans] = await Promise.all([
    prisma.crawlSession.findMany({ where: { organisationId: ctx.org.id }, orderBy: { startedAt: "desc" } }),
    prisma.requirement.findMany({ where: { organisationId: ctx.org.id }, select: { id: true, code: true, linkedTestsCount: true, createdAt: true } }),
    prisma.testPlan.findMany({ where: { organisationId: ctx.org.id }, select: { name: true } }),
  ]);
  const reqByCode = new Map(requirements.map((r) => [r.id, r]));
  return (
    <div className="space-y-5">
      <PageHeader title="Crawl" description="Every crawl of your application and the test cases it produced" />
      <Toolbar
        searchPlaceholder="Search"
        actions={<PageActions filter primary={<NewCrawlButton defaultUrl={ctx.org.website ?? ""} readOnly={ctx.readOnly} />} />}
      />
      <TableShell
        headers={["", "Name", "Format", "Type", "Test Plan", "Status", "Test Cases", "Created by", "Created Date", "Action"]}
        footer={<span className="tabular-nums">1–{Math.max(crawls.length, 0)} of {Math.max(crawls.length, 0)}</span>}
      >
        {crawls.length === 0 && (
          <tr>
            <td colSpan={10} className="px-4 py-14 text-center">
              <p className="text-[14px] font-medium text-[#374151]">No data available</p>
              <p className="mt-1 text-[12.5px] text-[#9ca3af]">Start a crawl with New Crawl. Logs and flows appear here.</p>
            </td>
          </tr>
        )}
        {crawls.map((c, index) => {
          const code = `REQ-${String(requirements.length - index).padStart(3, "0")}`;
          const linked = c.requirementId ? reqByCode.get(c.requirementId) : undefined;
          const name = c.explorePrompt?.trim() || `${formatDateTime(c.startedAt).replace(/[:\s]/g, "-")}_crawl`;
          const plan = c.createPlan ? plans[0]?.name ?? "-" : "-";
          return (
            <Tr key={c.id}>
              <Td className="w-8 pr-0">
                <input type="checkbox" aria-label={`Select ${name}`} className="size-3.5 rounded border-[#d1d5db] accent-[#5b4ee8]" />
              </Td>
              <Td>
                <p className="text-[10px] font-medium text-[#9ca3af]">{code}</p>
                <a href={`/dashboard/crawl/${c.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{name}</a>
              </Td>
              <Td>
                <span className="inline-flex items-center rounded bg-[#f3f4f6] px-2 py-0.5 text-[11.5px] font-medium text-[#374151]">Auto Crawl</span>
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1.5 text-[#4b5563]">
                  <CqaIcon name="language" className="text-[16px] text-[#6b7280]" /> Crawl
                </span>
              </Td>
              <Td className="max-w-[180px] truncate text-[#4b5563]">{plan}</Td>
              <Td><StatusPill value={c.status} label={crawlStatus(c.status)} /></Td>
              <Td>
                <span className="font-semibold text-[#1f2937]">{linked?.linkedTestsCount ?? c.flowsMapped}</span>{" "}
                <span className="text-[#6b7280]">Linked</span>
              </Td>
              <Td className="whitespace-nowrap text-[#4b5563]">{ctx.user.name}</Td>
              <Td className="whitespace-nowrap text-[#6b7280]">{formatDateTime(c.startedAt)}</Td>
              <Td>
                <RowMenu
                  items={[
                    { label: "View Details", icon: "visibility", href: `/dashboard/crawl/${c.id}` },
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
