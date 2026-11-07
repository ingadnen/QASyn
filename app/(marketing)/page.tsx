import Link from "next/link";
import { prisma } from "@/lib/db";
import { resolveOrgContext } from "@/lib/tenant";
import { CUSTOMER_WORDMARKS, KEY_METRICS, TESTIMONIALS } from "@/lib/marketing";
import { formatUsdCompact } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PILLARS = [
  {
    title: "Enterprise workflows",
    body: "Model end-to-end journeys across web, mobile and APIs. Ship keeps them green as your product changes.",
    icon: "M4 6h16M4 12h10M4 18h7",
  },
  {
    title: "Change intelligence",
    body: "Every PR is mapped to the flows it touches. Only the impacted tests run, and missing ones are generated.",
    icon: "M6 3v12a3 3 0 0 0 3 3h9M18 21l3-3-3-3M6 3l-3 3M6 3l3 3",
  },
  {
    title: "AI agent evaluation",
    body: "Score chatbots and agents on accuracy, safety and tool use with replayable conversation suites.",
    icon: "M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.8 7.1 18.2l.9-5.5-4-3.9 5.5-.8L12 3Z",
  },
];

const LOOP = [
  { tag: "DEPLOY", color: "text-sky-300", title: "Detect the change", body: "Ship watches deploys and pull requests across every connected repository." },
  { tag: "TEST", color: "text-emerald-300", title: "Run what matters", body: "Impacted tests run first; missing coverage becomes new regression cases." },
  { tag: "RCA", color: "text-amber-300", title: "Reproduce & explain", body: "Failures and production anomalies are reproduced with traces and a root cause." },
  { tag: "FIX", color: "text-brand-300", title: "Report quality", body: "A Release Quality Report scores the build before anyone clicks merge." },
];

async function getHeroReport() {
  try {
    // Session org if it already has runs, otherwise the shared Acme demo (isMockDemo).
    const ctx = await resolveOrgContext();
    const ownRuns = ctx ? await prisma.testRun.count({ where: { organisationId: ctx.org.id } }) : 0;
    const org = ctx && ownRuns > 0 ? ctx.org : await prisma.organisation.findFirst({ where: { isMockDemo: true } });
    if (!org) return null;
    const [latest, previous] = await prisma.testRun.findMany({
      where: { organisationId: org.id },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    if (!latest) return null;
    return { org: org.name, latest, delta: previous ? latest.qualityScore - previous.qualityScore : 0 };
  } catch {
    return null; // base non migrée : la vitrine reste affichable
  }
}

export default async function HomePage() {
  const report = await getHeroReport();
  const score = report?.latest.qualityScore ?? 92;
  const ring = 2 * Math.PI * 42;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_10%,rgba(61,46,224,0.14),transparent_70%),radial-gradient(40%_40%_at_10%_90%,rgba(34,211,238,0.10),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-16 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-muted shadow-sm">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Agentic Quality Engineering (AQE)
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
              AI quality engineering for enterprise apps{" "}
              <span className="font-serif font-normal italic text-brand-600">and AI agents.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              QASyn connects to your code, environments and issue tracker, then tests every change autonomously — catching
              regressions before merge and turning production signals into reproducible tests.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
              >
                Start free — onboard in 5 min
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-line bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:border-brand-300 hover:text-brand-700"
              >
                Explore the Acme demo →
              </Link>
            </div>
            <p className="mt-6 text-xs text-muted">No credit card · 3,000 free credits · Works with localhost</p>
          </div>

          {/* Release Quality Report (lu depuis SQLite) */}
          <div className="relative">
            <div className="animate-float rounded-[18px] border border-line bg-white p-6 shadow-2xl shadow-brand-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-muted">Release Quality Report</p>
                  <p className="mt-1 font-semibold text-ink">
                    Release #{report?.latest.release ?? 284} · {report?.latest.version ?? "v2.8.1"}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Ready to ship</span>
              </div>
              <div className="mt-6 flex items-center gap-6">
                <svg viewBox="0 0 100 100" className="size-28 -rotate-90" aria-hidden="true">
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-brand-50" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    strokeWidth="9"
                    strokeLinecap="round"
                    className="stroke-brand-600"
                    strokeDasharray={ring}
                    strokeDashoffset={ring * (1 - score / 100)}
                  />
                </svg>
                <div>
                  <p className="text-4xl font-semibold tracking-tight text-ink">
                    {score}
                    <span className="text-lg text-muted">/100</span>
                  </p>
                  <p className="text-sm font-medium text-emerald-600">↑ {report?.delta ?? 8} vs previous release</p>
                </div>
              </div>
              <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  { k: "Coverage", v: `${report?.latest.coverage ?? 94}%` },
                  { k: "Regressions", v: String(report?.latest.regressionsCaught ?? 3) },
                  { k: "Cost avoided", v: formatUsdCompact(report?.latest.costAvoided ?? 18400) },
                ].map((m) => (
                  <div key={m.k} className="rounded-[10px] bg-slate-50 px-2 py-3">
                    <dt className="text-[11px] text-muted">{m.k}</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{m.v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[11px] text-muted">
                Live from SQLite · {report ? `${report.org} workspace` : "demo data"}
              </p>
            </div>
            <div className="absolute -bottom-8 -left-6 hidden w-72 rounded-[10px] bg-term-950 p-4 font-mono text-[11px] leading-relaxed text-term-text shadow-xl ring-1 ring-white/10 sm:block">
              <p>
                <span className="text-sky-300">DEPLOY</span> {report?.latest.version ?? "v2.8.1"} detected
              </p>
              <p>
                <span className="text-term-mint">TEST</span> {report?.latest.testsPassed ?? 145}/{report?.latest.testsTotal ?? 148} passed
              </p>
              <p>
                <span className="text-amber-300">RCA</span> stale token · auth/refresh.ts:87
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WORDMARKS */}
      <section aria-label="Teams using QASyn (fictional)" className="border-y border-line bg-slate-50/60 py-8">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted">
          Trusted by quality-obsessed teams (fictional demo customers)
        </p>
        <div className="relative mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
          <div className="flex w-max animate-marquee gap-16 pr-16">
            {[...CUSTOMER_WORDMARKS, ...CUSTOMER_WORDMARKS].map((name, i) => (
              <span key={`${name}-${i}`} className="font-serif text-2xl text-slate-400" aria-hidden={i >= CUSTOMER_WORDMARKS.length}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand-600">One platform, three pillars</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Quality that keeps pace with <span className="font-serif font-normal italic">every deploy.</span>
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PILLARS.map((p) => (
            <article key={p.title} className="group rounded-[14px] border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-900/5">
              <span className="flex size-10 items-center justify-center rounded-[10px] bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d={p.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* AQE LOOP + METRICS */}
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold text-brand-300">The AQE loop</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                An AI QA engineer that <span className="font-serif font-normal italic text-brand-200">never sleeps.</span>
              </h2>
              <p className="mt-4 text-slate-400">
                Ship runs the full loop on every release, then writes everything back to your tools — PR comments, Jira tickets,
                Slack alerts.
              </p>
              <Link href="/ship" className="mt-8 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-brand-50">
                Explore Ship →
              </Link>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {LOOP.map((step, i) => (
                <li key={step.tag} className="rounded-[14px] bg-white/[0.04] p-5 ring-1 ring-white/10">
                  <p className={`font-mono text-xs font-semibold ${step.color}`}>
                    0{i + 1} · {step.tag}
                  </p>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <dl className="mt-16 grid gap-6 border-t border-white/10 pt-12 sm:grid-cols-2 lg:grid-cols-4">
            {KEY_METRICS.map((m) => (
              <div key={m.label}>
                <dt className="sr-only">{m.label}</dt>
                <dd className="font-serif text-5xl text-white">{m.value}</dd>
                <p className="mt-2 text-sm text-slate-400">{m.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-ink">
          Loved by teams that <span className="font-serif font-normal italic text-brand-600">ship daily</span>
        </h2>
        <p className="mt-2 text-center text-sm text-muted">Illustrative quotes from fictional demo customers.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-[14px] border border-line bg-white p-6">
              <p className="text-amber-400" aria-label="5 out of 5">★★★★★</p>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-ink">“{t.quote}”</blockquote>
              <figcaption className="mt-5 border-t border-line pt-4 text-sm">
                <span className="font-semibold text-ink">{t.name}</span>
                <span className="block text-xs text-muted">{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[24px] bg-brand-600 px-8 py-14 text-center text-white sm:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(255,255,255,0.18),transparent_70%)]"
          />
          <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
            Your next release, <span className="font-serif font-normal italic">already tested.</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-brand-100">
            Create an organisation, connect a repository, and watch Ship run its first analysis.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              Start free
            </Link>
            <Link href="/integrations" className="rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/10">
              Browse integrations
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
