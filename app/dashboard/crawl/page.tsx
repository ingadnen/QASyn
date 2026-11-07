import type { Metadata } from "next";
import { CrawlForm } from "@/components/dashboard/pages/Forms";
import { Card, EmptyState, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Crawl" };
export const dynamic = "force-dynamic";

export default async function CrawlPage() {
  const ctx = await requireOrgContext();
  const crawls = await prisma.crawlSession.findMany({ where: { organisationId: ctx.org.id }, orderBy: { startedAt: "desc" } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="AUTONOMOUS SDLC" title="Crawl" description="Autonomous crawling maps pages and flows, then generates draft test cases for your organisation only." />
      <Card title="Start a crawl"><div className="px-5 py-4"><CrawlForm defaultUrl={ctx.org.website ?? ""} readOnly={ctx.readOnly} /></div></Card>
      <Card title="Sessions">
        {crawls.length === 0 ? (
          <EmptyState title="No crawl yet" description="Start your first crawl above. Logs are generated dynamically from your domain." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {crawls.map((c) => (
              <li key={c.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-slate-800">{c.targetUrl}</span>
                  <StatusPill value={c.status} />
                  <span className="text-xs text-slate-500">{c.pagesVisited} pages · {c.flowsMapped} flows · {timeAgo(c.startedAt)}</span>
                  <span className="ml-auto flex gap-2">
                    {c.status === "running" && <ActionButton url={`/api/dashboard/crawl/${c.id}`} json={{ action: "complete" }} disabled={ctx.readOnly}>Complete now</ActionButton>}
                    {c.status === "running" && <ActionButton url={`/api/dashboard/crawl/${c.id}`} json={{ action: "cancel" }} variant="danger" disabled={ctx.readOnly}>Cancel</ActionButton>}
                  </span>
                </div>
                {c.logs !== "[]" && <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-300">{c.logs}</pre>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
