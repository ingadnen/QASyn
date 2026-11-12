/**
 * Shared marketing page renderer: dark-glass hero, capability bento, workflow
 * steps, FAQ and CTA — driven by a small typed content object.
 * Used by every /platform, /solutions, /integrations and company page, so the
 * Obsidian Quantum Precision palette propagates to every marketing subpage.
 */
import Link from "next/link";

export interface MarketingSection {
  heading: string;
  body: string;
}

export interface MarketingPageData {
  kicker: string;
  title: string;
  lede: string;
  features: Array<{ title: string; body: string }>;
  sections?: MarketingSection[];
  faqs?: Array<{ q: string; a: string }>;
}

export function MarketingPage({ data }: { data: MarketingPageData }) {
  return (
    <div className="bg-[#06080f] text-slate-100">
      <section className="obsidian-spotlight relative overflow-hidden border-b border-white/5">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 py-16">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-quantum-300">{data.kicker}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">{data.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400">{data.lede}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-r from-quantum-500 via-cobalt-500 to-cobalt-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-quantum-500/20 hover:brightness-110"
            >
              Start free
            </Link>
            <Link href="/contact-us" className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.08]">
              Book a demo
            </Link>
            <Link href="/guide" className="px-2 py-2.5 text-sm font-medium text-slate-400 transition hover:text-quantum-300">
              Interactive Guide ↗
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-alabaster py-16 text-[#0F172A]">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.features.map((f) => (
              <article key={f.title} className="rounded-2xl border border-hairline bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-quantum-500/40 hover:shadow-lg hover:shadow-slate-900/5">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-quantum-500/15 to-cobalt-500/10 text-sm text-quantum-600" aria-hidden="true">
                  ✓
                </span>
                <h2 className="mt-3 text-sm font-semibold text-[#0F172A]">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </article>
            ))}
          </div>

          {data.sections?.map((s) => (
            <section key={s.heading} className="mt-12">
              <h2 className="text-xl font-semibold text-[#0F172A]">{s.heading}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{s.body}</p>
            </section>
          ))}

          {data.faqs && data.faqs.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold text-[#0F172A]">Frequently asked questions</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.faqs.map((f) => (
                  <li key={f.q} className="rounded-2xl border border-hairline bg-white p-4">
                    <p className="text-sm font-semibold text-[#0F172A]">{f.q}</p>
                    <p className="mt-1 text-sm text-slate-600">{f.a}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-quantum-500/20 via-cobalt-500/15 to-transparent p-8">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(6,182,212,0.18),transparent_70%)]" />
          <h2 className="relative text-xl font-semibold text-white">See QASyn test your application in 30 minutes</h2>
          <p className="relative mt-2 text-sm text-slate-300">Autonomous quality engineering, grounded in visual proof. Crawl, author, heal and gate every release.</p>
          <div className="relative mt-5 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0B1120] hover:bg-quantum-100">
              Start free
            </Link>
            <Link href="/dashboard/overview" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
              Open the dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
