import Link from "next/link";
import { CUSTOMER_WORDMARKS, KEY_METRICS, TESTIMONIALS } from "@/lib/marketing";
import { formatUsdCompact } from "@/lib/utils";
import { HeroShowcase } from "@/components/marketing/HeroShowcase";

export const dynamic = "force-dynamic";

const BENTO = [
  {
    key: "crawl",
    kicker: "Autonomous Crawl",
    title: "Map the whole product, then test what matters.",
    body: "QASyn crawls your deployed app, maps flows to requirements, and authors linked regression cases automatically.",
    accent: "from-quantum-500/15 to-transparent",
    span: "md:col-span-3",
    icon: "🕸️",
  },
  {
    key: "lightbox",
    kicker: "Time-Travel Evidence",
    title: "Every step, visually proven.",
    body: "Click any capture for a full-resolution lightbox with Run N vs Run N-1 compare and a stability badge.",
    accent: "from-cobalt-500/15 to-transparent",
    span: "md:col-span-3",
    icon: "🕰️",
  },
  {
    key: "vision-ai",
    kicker: "QASyn Vision AI",
    title: "Calibrated visual verification & telemetry.",
    body: "Visual assertions, locator grounding, risk scoring and test selection stream into a live quality telemetry ledger with confidence and manual QA savings.",
    accent: "from-emerald-500/15 to-transparent",
    span: "md:col-span-2",
    icon: "🧠",
  },
  {
    key: "strix",
    kicker: "Strix Security",
    title: "OWASP posture on every target.",
    body: "CSP, HSTS, frame protection and cookie posture graded A-F before a release ever goes live.",
    accent: "from-signal-amber/15 to-transparent",
    span: "md:col-span-2",
    icon: "🛡️",
  },
  {
    key: "mcp",
    kicker: "Native MCP Server",
    title: "21 JSON-RPC tools for your agents.",
    body: "Claude Code, Cursor and Copilot drive QASyn directly over SSE or JSON-RPC.",
    accent: "from-quantum-500/10 to-transparent",
    span: "md:col-span-2",
    icon: "🔌",
  },
];

const LOOP = [
  { tag: "CRAWL", color: "text-brand-600", title: "Detect the change", body: "QASyn watches deploys and pull requests across every connected repository." },
  { tag: "AUTHOR", color: "text-brand-500", title: "Run what matters", body: "Impacted tests run first; missing coverage becomes new regression cases." },
  { tag: "HEAL", color: "text-amber-600", title: "Reproduce & explain", body: "Failures and production anomalies are reproduced with traces and a root cause." },
  { tag: "GATE", color: "text-cobalt-500", title: "Report quality", body: "A Release Quality Report scores the build before anyone clicks merge." },
];

const SHOWCASE_REPORT = {
  org: "FinTech Cloud",
  latest: { qualityScore: 96, coverage: 94, costAvoided: 24800, version: "v3.2.0", testsPassed: 147, testsTotal: 148, release: 312, regressionsCaught: 2 },
  delta: 6,
};

export default function HomePage() {
  const report = SHOWCASE_REPORT;
  const score = report.latest.qualityScore;
  const ring = 2 * Math.PI * 42;

  return (
    <>
      {/* HERO — Precision Workspace light */}
      <section className="obsidian-spotlight relative overflow-hidden">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1440px] items-center gap-14 px-6 sm:px-8 lg:px-12 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-medium text-brand-700">
              <span className="quantum-pulse size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
              🧠 Powered by QASyn Vision AI Multimodal AI · Strix OWASP · Graphify AST
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-pw-heading sm:text-5xl lg:text-[3.6rem]">
              Autonomous Quality Engineering.
              <span className="quantum-text mt-1 block">Grounded in Visual Proof.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pw-muted">
              QASyn connects to your code, environments and issue tracker, then crawls, authors, heals and executes every
              change — with a real screenshot on every step and an evidence-backed PR gate before merge.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
              >
                Launch QASyn Studio →
              </Link>
              <Link
                href="/qasyn"
                className="rounded-full border border-pw-line bg-white px-6 py-3 text-sm font-semibold text-pw-heading transition hover:border-brand-400 hover:text-brand-700"
              >
                Explore QASyn Agent
              </Link>
              <Link href="/pricing" className="px-2 py-3 text-sm font-medium text-pw-muted transition hover:text-brand-700">
                View pricing →
              </Link>
            </div>
            <p className="mt-6 text-xs text-pw-muted">No credit card · 3,000 free credits · Works with localhost · 11 test types</p>
          </div>

          <div>
            <HeroShowcase />
            <div data-testid="marketing-kpi-row" className="mt-3 grid grid-cols-3 gap-2">
              {[
                { k: "Quality score", v: `${score}/100` },
                { k: "Coverage", v: `${report?.latest.coverage ?? 94}%` },
                { k: "Cost avoided", v: formatUsdCompact(report?.latest.costAvoided ?? 18400) },
              ].map((metric) => (
                <div key={metric.k} data-testid="marketing-kpi-card" className="rounded-lg border border-pw-line bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-pw-muted">{metric.k}</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-pw-heading">{metric.v}</p>
                </div>
              ))}
            </div>
            <div
              data-testid="marketing-hero-telemetry"
              className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-obsidian-950 bg-obsidian-950 px-4 py-3 font-mono text-[11.5px] leading-relaxed text-slate-300"
            >
              <span><span className="text-quantum-300">DEPLOY</span> {report?.latest.version ?? "v2.8.1"} detected</span>
              <span><span className="text-emerald-300">TEST</span> {report?.latest.testsPassed ?? 145}/{report?.latest.testsTotal ?? 148} passed</span>
              <span><span className="text-amber-300">HEAL</span> stale token · auth/refresh.ts:87</span>
              <span><span className="text-quantum-200">GATE</span> ✅ approved · 3 regressions caught</span>
            </div>
            <p className="mt-2 text-[10.5px] text-pw-muted">
              QASyn Live Sandbox · {report.org}
            </p>
          </div>
        </div>

        {/* Live release ring, integrated into the hero as a precision strip */}
        <div className="relative mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 pb-14">
          <div className="flex flex-wrap items-center gap-5 rounded-lg border border-pw-line bg-white px-5 py-4 shadow-sm">
            <svg viewBox="0 0 100 100" className="size-16 -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-brand-100" />
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
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-pw-muted">Release Quality Report</p>
              <p className="mt-0.5 text-sm font-semibold text-pw-heading">
                Release #{report?.latest.release ?? 284} · {report?.latest.version ?? "v2.8.1"} · {score}/100
                <span className="ml-2 text-xs font-medium text-brand-600">↑ {report?.delta ?? 8} vs previous</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-medium">
              <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-brand-700">Ready to merge</span>
              <span className="rounded-full border border-brand-200 bg-white px-3 py-1 text-brand-700">{report?.latest.regressionsCaught ?? 3} regressions caught</span>
              <span className="rounded-full border border-pw-line bg-pw-bg px-3 py-1 text-[#3b4a53]">{report?.latest.testsPassed ?? 145}/{report?.latest.testsTotal ?? 148} tests passed</span>
            </div>
          </div>
        </div>
      </section>

      {/* WORDMARKS */}
      <section aria-label="Teams using QASyn" className="border-y border-pw-line bg-white py-8">
        <p className="text-center text-[10.5px] font-medium uppercase tracking-[0.2em] text-pw-muted">
          Trusted by quality-obsessed teams
        </p>
        <div className="relative mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
          <div className="flex w-max animate-marquee gap-16 pr-16">
            {[...CUSTOMER_WORDMARKS, ...CUSTOMER_WORDMARKS].map((name, i) => (
              <span key={`${name}-${i}`} className="font-serif text-2xl text-[#9aa6ad]" aria-hidden={i >= CUSTOMER_WORDMARKS.length}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* BENTO — Precision Workspace contrast */}
      <section className="bg-[#FAFAF7] py-24 text-pw-ink">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Precision by construction</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-pw-heading sm:text-4xl">
              Six systems. One evidence trail.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-pw-muted">
              Every capability writes back to the same calibre of proof: screenshots, calibrated confidence, audit entries and run metadata.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-6">
            {BENTO.map((card) => (
              <article
                key={card.key}
                className={`group relative overflow-hidden rounded-lg border border-pw-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lg hover:shadow-black/5 ${card.span}`}
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${card.accent} opacity-30`} aria-hidden="true" />
                <span className="relative flex size-10 items-center justify-center rounded-lg border border-pw-line bg-pw-bg text-lg">{card.icon}</span>
                <p className="relative mt-4 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-brand-600">{card.kicker}</p>
                <h3 className="relative mt-1.5 text-lg font-semibold tracking-tight text-pw-heading">{card.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-pw-muted">{card.body}</p>
              </article>
            ))}
            <article className="group relative overflow-hidden rounded-lg border border-obsidian-950 bg-obsidian-950 p-6 text-white md:col-span-6 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-xl">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-quantum-300">Enterprise Multi-Tenant</p>
                  <h3 className="mt-1.5 text-lg font-semibold tracking-tight">Super Admin provisioning, in one modal.</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Provision an Enterprise tenant, allocate workspace AI credits to the ledger, seed Production + Staging, and configure website, seats, SSO and SLA — with AES-256-GCM secret encryption.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                  {["Enterprise plan", "Custom credits", "SSO/SAML", "Dedicated admin", "System audit"].map((chip) => (
                    <span key={chip} className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-slate-200">{chip}</span>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* AQE LOOP + METRICS */}
      <section className="bg-white text-pw-ink">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold text-brand-600">The autonomous loop</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-pw-heading sm:text-4xl">
                An AI QA engineer that <span className="font-serif font-normal italic text-brand-600">never sleeps.</span>
              </h2>
              <p className="mt-4 text-pw-muted">
                QASyn runs the full loop on every release, then writes everything back to your tools — PR comments, Jira tickets,
                Slack alerts.
              </p>
              <Link href="/qasyn" className="mt-8 inline-flex rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500">
                Explore QASyn Agent →
              </Link>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {LOOP.map((step, i) => (
                <li key={step.tag} className="rounded-lg border border-pw-line bg-pw-bg p-5">
                  <p className={`font-mono text-xs font-semibold ${step.color}`}>
                    0{i + 1} · {step.tag}
                  </p>
                  <h3 className="mt-3 font-semibold text-pw-heading">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-pw-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <dl className="mt-16 grid gap-6 border-t border-pw-line pt-12 sm:grid-cols-2 lg:grid-cols-4">
            {KEY_METRICS.map((m) => (
              <div key={m.label}>
                <dt className="sr-only">{m.label}</dt>
                <dd className="font-serif text-5xl tabular-nums text-pw-heading">{m.value}</dd>
                <p className="mt-2 text-sm text-pw-muted">{m.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-[#FAFAF7] py-24 text-pw-ink">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-pw-heading">
            Loved by teams that <span className="font-serif font-normal italic text-brand-600">build with QASyn daily</span>
          </h2>
          <p className="mt-2 text-center text-sm text-pw-muted">What quality leaders say about working with QASyn.</p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="flex flex-col rounded-lg border border-pw-line bg-white p-6">
                <p className="text-signal-amber" aria-label="5 out of 5">★★★★★</p>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-[#3b4a53]">“{t.quote}”</blockquote>
                <figcaption className="mt-5 border-t border-pw-line pt-4 text-sm">
                  <span className="font-semibold text-pw-heading">{t.name}</span>
                  <span className="block text-xs text-pw-muted">{t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-obsidian-950 px-5 py-24">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1440px] overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-brand-600/25 via-brand-800/20 to-transparent px-8 py-14 text-center sm:px-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(15,107,92,0.25),transparent_70%)]" />
          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Your next release, <span className="font-serif font-normal italic text-quantum-200">already tested.</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-slate-300">
            Create an organisation, connect a repository, and watch QASyn run its first analysis.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-400">
              Start free
            </Link>
            <Link href="/dashboard/overview" className="rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">
              Open the dashboard
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
