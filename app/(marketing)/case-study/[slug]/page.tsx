import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Case study" };
export const dynamic = "force-dynamic";

export default async function CaseStudySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const study = await prisma.caseStudy.findUnique({ where: { slug } });
  if (!study) notFound();
  let metrics: Array<{ metric: string; label: string }> = [];
  try {
    metrics = JSON.parse(study.resultsJson || "[]");
  } catch {
    metrics = [];
  }
  return (
    <article className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Case study · {study.industry}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{study.companyName}</h1>
      <p className="mt-4 border-l-4 border-brand-500 bg-brand-50 px-4 py-3 text-lg text-ink italic">“{study.heroQuote}”</p>
      <div className="mt-8 grid grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-line bg-white p-4 text-center">
            <p className="text-2xl font-semibold text-ink">{m.metric}</p>
            <p className="text-xs text-muted">{m.label}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-10 text-xl font-semibold text-ink">Challenge</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{study.challenge}</p>
      <h2 className="mt-8 text-xl font-semibold text-ink">Solution</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{study.solution}</p>
      <h2 className="mt-8 text-xl font-semibold text-ink">Full story</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{study.fullStory}</p>
    </article>
  );
}
