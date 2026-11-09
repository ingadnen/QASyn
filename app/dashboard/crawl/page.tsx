import type { Metadata } from "next";
import Link from "next/link";
import { NewCrawlButton } from "@/components/dashboard/pages/NewCrawlButton";
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
      <PageHeader
        kicker="AUTONOMOUS SDLC"
        title="Crawl"
        description={`Every crawl of your application and the test cases it produced — ${ctx.org.website ?? "no website set"}.`}
        actions={<NewCrawlButton defaultUrl={ctx.org.website ?? ""} readOnly={ctx.readOnly} />}
      />
      <Card title={`${crawls.length} sessions`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] tracking-widest text-slate-400 uppercase">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Format</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Test Plan</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Test Cases</th>
                <th className="px-4 py-2">Created by</th>
                <th className="px-4 py-2">Created Date</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {crawls.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center">
                    <EmptyState title="No crawls yet" description="Start a crawl with + New Crawl. Logs and flows appear here." />
                  </td>
                </tr>
              )}
              {crawls.map((c) => {
                  let testTypes: string[] = [];
                  try {
                    testTypes = JSON.parse(c.testTypesJson || "[]");
                  } catch {
                    testTypes = [];
                  }
                  return (
                    <tr key={c.id} className="border-b border-slate-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/dashboard/crawl/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.targetUrl}</Link>
                        <p className="text-xs text-slate-400">{c.pagesVisited} pages · {c.flowsMapped} flows{testTypes.length ? ` · ${testTypes.join(", ")}` : ""}{c.publishMode ? ` · ${c.publishMode}` : ""}</p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">Auto Crawl</td>
                      <td className="px-4 py-2.5 text-slate-600">language / Crawl</td>
                      <td className="px-4 py-2.5 text-slate-600">{c.publishMode === "Auto publish" ? "Auto plan" : "—"}</td>
                      <td className="px-4 py-2.5"><StatusPill value={c.status} /></td>
                      <td className="px-4 py-2.5 text-slate-600">{c.flowsMapped} Linked</td>
                      <td className="px-4 py-2.5 text-slate-600">{ctx.user.name}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{timeAgo(c.startedAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex gap-1">
                          {c.status === "running" && <ActionButton url={`/api/dashboard/crawl/${c.id}`} json={{ action: "complete" }} disabled={ctx.readOnly}>Complete now</ActionButton>}
                          {c.status === "running" && <ActionButton url={`/api/dashboard/crawl/${c.id}`} json={{ action: "cancel" }} variant="danger" disabled={ctx.readOnly}>Cancel</ActionButton>}
                          <Link href={`/dashboard/crawl/${c.id}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">View</Link>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </Card>
    </div>
  );
}
