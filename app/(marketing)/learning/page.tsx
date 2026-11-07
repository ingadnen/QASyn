import type { Metadata } from "next";
import Link from "next/link";
import { LEARNING_SECTIONS } from "@/lib/learning";

export const metadata: Metadata = { title: "Learning — QASyn" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { guide: "Guide", tutorial: "Tutorial", video: "Video", demo: "Interactive demo" };

export default function PublicLearningPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600">CONTEXTQA LEARNING HUB</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Learn AI-powered test automation</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Complete reference for AI-powered test automation: no-code / NLP test creation, agentic execution, AI
        self-healing, cross-browser and mobile testing, API testing, CI/CD gates and reporting. Every module
        launches directly inside your workspace with persisted progress.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/signup" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500">
          Start free
        </Link>
        <Link href="/dashboard/learning" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50">
          Open in workspace
        </Link>
        <Link href="/login" className="rounded-full px-5 py-2.5 text-sm font-medium text-muted hover:text-ink">
          Log in
        </Link>
      </div>

      <div className="mt-10 space-y-10">
        {LEARNING_SECTIONS.map((section) => (
          <section key={section.name}>
            <h2 className="text-lg font-semibold text-ink">{section.name}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.modules.map((mod) => (
                <article key={mod.id} className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700 uppercase">{KIND_LABEL[mod.kind]}</span>
                    <span className="text-xs text-muted">{mod.minutes} min</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-ink">{mod.title}</h3>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">{mod.description}</p>
                  <Link href="/dashboard/learning" className="mt-3 text-xs font-semibold text-brand-600 hover:underline">
                    {mod.cta} →
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-2xl bg-navy-900 p-6 text-white">
        <h2 className="text-lg font-semibold">See ContextQA test your application in 30 minutes</h2>
        <p className="mt-1 text-sm text-slate-300">Book a free demo or create your workspace and run your first crawl today.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-400">Start free</Link>
          <Link href="/integrations" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Explore integrations</Link>
        </div>
      </div>
    </div>
  );
}
