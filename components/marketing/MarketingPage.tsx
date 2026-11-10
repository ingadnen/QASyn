/**
 * Shared marketing page renderer: hero, capability grid, workflow steps,
 * FAQ and CTA — driven by a small typed content object.
 * Used by every /platform, /solutions, /integrations and company page.
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
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">{data.kicker}</p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{data.title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted">{data.lede}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500">Start free</Link>
        <Link href="/contact-us" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50">Book a demo</Link>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.features.map((f) => (
          <article key={f.title} className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-ink">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </article>
        ))}
      </div>

      {data.sections?.map((s) => (
        <section key={s.heading} className="mt-12">
          <h2 className="text-xl font-semibold text-ink">{s.heading}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{s.body}</p>
        </section>
      ))}

      {data.faqs && data.faqs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">Frequently asked questions</h2>
          <ul className="mt-4 space-y-3">
            {data.faqs.map((f) => (
              <li key={f.q} className="rounded-xl border border-line bg-white p-4">
                <p className="text-sm font-semibold text-ink">{f.q}</p>
                <p className="mt-1 text-sm text-muted">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-14 rounded-2xl bg-navy-900 p-8 text-white">
        <h2 className="text-xl font-semibold">See QASyn test your application in 30 minutes</h2>
        <p className="mt-2 text-sm text-slate-300">The agentic AI testing platform. One place to write, heal, and run tests across web, mobile, API, and AI agents.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-400">Start free</Link>
          <Link href="/dashboard/overview" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Open the dashboard</Link>
        </div>
      </div>
    </div>
  );
}
