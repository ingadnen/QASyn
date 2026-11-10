import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Comparison" };
export const dynamic = "force-dynamic";

const ROWS: Array<[string, string, string]> = [
  ["Single unified platform (web, mobile, API, agents)", "✓", "✕ (add-ons)"],
  ["Agentic AI authoring (NLP steps, crawl-to-test)", "✓", "Partial"],
  ["Multi-layer fingerprinting self-healing (0.2/0.4/0.3/0.1)", "✓", "✕"],
  ["MCP server for Cursor / Claude Code", "✓", "✕"],
  ["CodiTOS code export (Playwright, Selenium, Cypress)", "✓", "Partial"],
  ["Physical browser execution (Chrome/Firefox/WebKit)", "✓", "✓"],
  ["Autonomous Ship release pipeline (Go/No-Go)", "✓", "✕"],
  ["12-week enterprise pilot with SLA", "✓", "✕"],
];

export default async function ComparisonSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const titles: Record<string, string> = {
    "contextqa-vs-browserstack": "QASyn vs BrowserStack",
    "contextqa-vs-testmuai": "QASyn vs TestMu AI (LambdaTest)",
    "mabl-vs-contextqa": "Mabl vs QASyn",
    "testsigma-vs-contextqa": "Testsigma vs QASyn",
  };
  const title = titles[slug];
  if (!title) return <p className="px-5 py-12">Unknown comparison.</p>;
  const [a, b] = title.includes("vs") ? title.split(" vs ") : [title, "Competitor"];
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Comparison</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <div className="mt-8 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 font-semibold text-ink">Capability</th>
              <th className="px-4 py-3 font-semibold text-brand-700">{a}</th>
              <th className="px-4 py-3 font-semibold text-slate-500">{b}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]} className="border-b border-slate-50">
                <td className="px-4 py-2.5 text-slate-700">{r[0]}</td>
                <td className="px-4 py-2.5 font-medium text-emerald-700">{r[1]}</td>
                <td className="px-4 py-2.5 text-slate-500">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-muted">Migration guide: import existing suites via MCP, re-run with healing enabled, and export clean code with CodiTOS — no vendor lock-in.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/signup" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500">Start free</Link>
        <Link href="/pilot-program" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50">Apply for pilot</Link>
      </div>
    </div>
  );
}
