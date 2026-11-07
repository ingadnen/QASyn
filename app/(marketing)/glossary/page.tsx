import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Glossary" };
export const dynamic = "force-dynamic";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default async function GlossaryPage() {
  const terms = await prisma.glossaryTerm.findMany({ orderBy: { term: "asc" } });
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Glossary</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">QA & test automation glossary</h1>
      <p className="mt-2 text-sm text-muted">A-to-Z definitions with instant cross-links. {terms.length} terms.</p>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {LETTERS.map((l) => {
          const has = terms.some((t) => t.term[0]?.toUpperCase() === l);
          return (
            <a key={l} href={`#letter-${l}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${has ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"}`}>{l}</a>
          );
        })}
      </div>
      {LETTERS.map((l) => {
        const bucket = terms.filter((t) => t.term[0]?.toUpperCase() === l);
        if (!bucket.length) return null;
        return (
          <section key={l} id={`letter-${l}`} className="mt-10">
            <h2 className="text-xl font-semibold text-ink">{l}</h2>
            <ul className="mt-3 space-y-3">
              {bucket.map((t) => (
                <li key={t.slug} className="rounded-xl border border-line bg-white p-4">
                  <p className="text-sm font-semibold text-ink">{t.term} <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">{t.category}</span></p>
                  <p className="mt-1 text-sm text-muted">{t.shortDef}</p>
                  <p className="mt-1 text-xs text-slate-500">{t.detailedDef}</p>
                  {t.relatedTerms && <p className="mt-1 text-xs text-slate-400">Related: {t.relatedTerms}</p>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {terms.length === 0 && <p className="mt-8 text-sm text-muted">No terms yet — run <code>npm run db:seed</code>.</p>}
    </div>
  );
}
