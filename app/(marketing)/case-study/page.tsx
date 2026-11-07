import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Case studies" };
export const dynamic = "force-dynamic";

export default async function CaseStudyIndexPage() {
  const studies = await prisma.caseStudy.findMany({ orderBy: [{ featured: "desc" }, { publishedAt: "desc" }], take: 20 });
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Case studies</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Customer case studies</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">In-depth stories from FinTech, retail, SaaS and healthcare teams — with quantified ROI.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {studies.map((s) => {
          let metrics: Array<{ metric: string; label: string }> = [];
          try {
            metrics = JSON.parse(s.resultsJson || "[]");
          } catch {
            metrics = [];
          }
          return (
            <Link key={s.slug} href={`/case-study/${s.slug}`} className="rounded-xl border border-line bg-white p-6 shadow-sm transition hover:border-brand-300">
              <p className="text-[11px] font-semibold tracking-widest text-brand-600 uppercase">{s.industry}</p>
              <h2 className="mt-2 text-lg font-semibold text-ink">{s.companyName}</h2>
              <p className="mt-2 text-sm text-muted italic">“{s.heroQuote}”</p>
              <div className="mt-4 flex flex-wrap gap-4">
                {metrics.slice(0, 3).map((m) => (
                  <span key={m.label}><strong className="text-xl text-ink">{m.metric}</strong> <span className="block text-xs text-muted">{m.label}</span></span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
      {studies.length === 0 && <p className="mt-8 text-sm text-muted">No case studies yet — run <code>npm run db:seed</code>.</p>}
    </div>
  );
}
