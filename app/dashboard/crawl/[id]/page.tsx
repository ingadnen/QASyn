import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader, StatusPill, ActionButton } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Live crawl" };
export const dynamic = "force-dynamic";

export default async function CrawlDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const crawl = await prisma.crawlSession.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!crawl) notFound();
  const cases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id, source: "crawl" }, orderBy: { createdAt: "desc" }, take: 20 });
  const host = crawl.targetUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const running = crawl.status === "running";
  const elapsed = Math.max(0, Math.round((Date.now() - crawl.startedAt.getTime()) / 1000));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="REQUIREMENTS DETAILS · LIVE CRAWL"
        title={crawl.targetUrl}
        description={`${crawl.status === "completed" ? "Completed" : "In Progress"} · ${crawl.pagesVisited} pages · ${crawl.flowsMapped} flows · started ${timeAgo(crawl.startedAt)}`}
        actions={
          <>
            <StatusPill value={crawl.status} />
            {running && <ActionButton url={`/api/dashboard/crawl/${crawl.id}`} json={{ action: "complete" }} disabled={ctx.readOnly}>Complete Crawl & Generate Cases</ActionButton>}
            {running && <ActionButton url={`/api/dashboard/crawl/${crawl.id}`} json={{ action: "cancel" }} variant="danger" disabled={ctx.readOnly}>Stop</ActionButton>}
            <Link href="/dashboard/crawl" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">← All crawls</Link>
          </>
        }
      />

      {running && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          I am still crawling this activity. Test cases land in the table below as each one is generated. You can leave this page — everything continues in the background.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1">
            {["Test Cases", "Questionnaire", "Requirement Data", "History", "Metadata", "Gaps"].map((t, i) => (
              <span key={t} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i === 0 ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>{t}</span>
            ))}
          </div>
          <Card title={`Generated Test Cases (${cases.length})`}>
            {cases.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No test cases generated yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cases.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                    <Link href={`/dashboard/test-studio/${c.id}`} className="flex-1 font-medium text-brand-700 hover:underline">{c.title}</Link>
                    <span className="text-xs text-slate-500">{c.module} · {c.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Gaps — uncovered flows">
            <p className="px-5 py-4 text-sm text-slate-600">Uncovered flows appear here after the first crawl completes (provisional).</p>
          </Card>
        </div>

        <aside className="h-fit rounded-xl border border-slate-200 bg-slate-900 text-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Live crawl</span>
            <StatusPill value={crawl.status} />
          </div>
          <div className="space-y-3 px-4 py-4">
            <p className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 font-mono text-xs">🔒 {host} · READ-ONLY</p>
            <p className="text-sm"><span className={running ? "text-amber-300" : "text-slate-400"}>{running ? "Exploring your app" : crawl.status}</span> · <span className="font-mono text-slate-400">{elapsed}s</span></p>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white/5 p-2"><p className="text-lg font-semibold">{crawl.pagesVisited}</p>pages</div>
              <div className="rounded-lg bg-white/5 p-2"><p className="text-lg font-semibold">{crawl.flowsMapped}</p>flows</div>
            </div>
            <p className="text-xs text-slate-400">Activity {crawl.pagesVisited + crawl.flowsMapped} · Drafts {cases.length}</p>
            <p className="text-xs text-slate-500">{running ? "Joined live. Earlier activity is on the crawl details page." : "Crawl complete — cases are ready in the table."}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
