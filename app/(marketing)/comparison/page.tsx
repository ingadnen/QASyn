import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Comparison" };
export const dynamic = "force-dynamic";

const PAGES = [
  { slug: "contextqa-vs-browserstack", title: "ContextQA vs BrowserStack", blurb: "Agentic authoring vs grid-only testing." },
  { slug: "contextqa-vs-testmuai", title: "ContextQA vs TestMu AI (LambdaTest)", blurb: "Unified platform vs AI add-on." },
  { slug: "mabl-vs-contextqa", title: "Mabl vs ContextQA", blurb: "Low-code recorders vs autonomous agents." },
  { slug: "testsigma-vs-contextqa", title: "Testsigma vs ContextQA", blurb: "Codeless scripts vs MCP-native agents." },
];

export default function ComparisonIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Comparison</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Head-to-head comparisons</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PAGES.map((p) => (
          <Link key={p.slug} href={`/comparison/${p.slug}`} className="rounded-xl border border-line bg-white p-6 shadow-sm transition hover:border-brand-300">
            <h2 className="text-base font-semibold text-ink">{p.title}</h2>
            <p className="mt-1 text-sm text-muted">{p.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
