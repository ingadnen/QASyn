import type { Metadata } from "next";

export const metadata: Metadata = { title: "FAQs" };
export const dynamic = "force-dynamic";

const FAQS: Array<{ category: string; items: Array<{ q: string; a: string }> }> = [
  {
    category: "General",
    items: [
      { q: "What is QASyn / QASyn?", a: "The agentic AI testing platform: one place to write, heal, and run tests across web, mobile, API, and AI agents." },
      { q: "How does self-healing work?", a: "Failed selectors are repaired by scoring DOM candidates (0.2 Tag + 0.4 Attributes + 0.3 Text + 0.1 Position). Above 0.45 the selector is rewritten and the step flagged HEALED." },
      { q: "Which browsers are supported?", a: "Chrome, Firefox, Safari (WebKit) and Edge on a parallel cloud grid." },
    ],
  },
  {
    category: "Security",
    items: [
      { q: "How is tenant data isolated?", a: "Every row stores organisationId; every query is scoped server-side. API tokens resolve the organisation from a SHA-256 hash — never from client input." },
      { q: "Are credentials encrypted?", a: "Yes — AES-256-GCM at rest; environment secrets are masked in logs and UI." },
    ],
  },
  {
    category: "Pricing",
    items: [
      { q: "How do credits work?", a: "Trial includes 3,000 one-time credits. Test runs, AI generation and analyses consume credits per action." },
      { q: "What is the pilot program?", a: "A 12-week enterprise pilot on your real codebase with SLA and a documented Go/No-Go exit." },
    ],
  },
  {
    category: "Engine",
    items: [
      { q: "How does the MCP server authenticate?", a: "Bearer cqa_… API tokens (SHA-256 stored, shown once) over SSE / JSON-RPC. Claude Code, Cursor and Windsurf supported." },
      { q: "Can I export my tests?", a: "Yes — CodiTOS exports Playwright, Selenium, Cypress and WebdriverIO code with Page Objects and CI configs. No vendor lock-in." },
    ],
  },
];

export default function FaqsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Company · FAQ</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Frequently asked questions</h1>
      {FAQS.map((cat) => (
        <section key={cat.category} className="mt-10">
          <h2 className="text-lg font-semibold text-ink">{cat.category}</h2>
          <ul className="mt-4 space-y-3">
            {cat.items.map((f) => (
              <li key={f.q} className="rounded-xl border border-line bg-white p-4">
                <p className="text-sm font-semibold text-ink">{f.q}</p>
                <p className="mt-1 text-sm text-muted">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
