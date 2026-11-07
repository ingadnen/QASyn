import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Tutorials" };
export const dynamic = "force-dynamic";

const TUTS = [
  { href: "/learning", title: "Quickstart: your first crawl", steps: ["Create workspace", "Connect environment", "Run crawl", "Generate test cases"] },
  { href: "/dashboard/test-cases?new=1", title: "Create a test case (NLP)", steps: ["Describe steps", "Run once", "Enable healing", "Schedule"] },
  { href: "/dashboard/plans/test-plans", title: "Build a regression suite", steps: ["Group cases", "Set browsers", "Schedule nightly", "Gate PRs"] },
  { href: "/dashboard/agent-testing", title: "Evaluate an AI agent", steps: ["Declare suite", "Attach knowledge base", "Run guardrails", "Read judge matrix"] },
];

export default function TutorialsPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · Tutorials</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Step-by-step tutorials</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {TUTS.map((t) => (
          <Link key={t.title} href={t.href} className="rounded-xl border border-line bg-white p-5 shadow-sm transition hover:border-brand-300">
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
              {t.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <p className="mt-3 text-xs font-semibold text-brand-600">Start tutorial →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
