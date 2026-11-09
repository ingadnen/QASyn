import type { Metadata } from "next";
import { DeleteKnowledgeButton, KnowledgeCreateButton } from "@/components/dashboard/pages/KnowledgeCreateButton";
import { CqaIcon, PageHeader, StatusPill, cqaBtnSecondary, cqaCard } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Knowledge Base" };
export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireOrgContext();
  const { q = "" } = await searchParams;
  const items = await prisma.knowledgeItem.findMany({ where: { organisationId: ctx.org.id }, orderBy: { updatedAt: "desc" } });
  const filtered = items.filter((i) => !q || `${i.title} ${i.type} ${i.urlOrPath}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader title="Knowledge Base" />

      <div className="flex flex-wrap items-center gap-2">
        <KnowledgeCreateButton readOnly={ctx.readOnly} />
        <form method="get" className="relative min-w-[220px] flex-1">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
          <input
            name="q"
            defaultValue={q}
            aria-label="Search knowledge base"
            placeholder="Search"
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
          />
        </form>
        <a href="/dashboard/knowledge-base" aria-label="Refresh" className={cqaBtnSecondary}>
          <CqaIcon name="refresh" className="text-[18px]" />
        </a>
      </div>

      <div className={cqaCard}>
        {filtered.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-[14px] font-medium text-[#374151]">No data available</p>
            <p className="mt-1 text-[12.5px] text-[#9ca3af]">There is no data available to display.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f1f3]">
                  {["Name", "Type", "Status", "Updated", "Action"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CqaIcon name="article" className="text-[18px] text-[#9ca3af]" />
                        <div>
                          <p className="font-medium text-[#1f2937]">{i.title}</p>
                          <p className="max-w-[360px] truncate text-[11.5px] text-[#9ca3af]">{i.urlOrPath}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] capitalize text-[#4b5563]">{i.type}</td>
                    <td className="px-4 py-3"><StatusPill value={i.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#6b7280]">{timeAgo(i.updatedAt)}</td>
                    <td className="px-4 py-3"><DeleteKnowledgeButton id={i.id} name={i.title} readOnly={ctx.readOnly} /></td>
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
