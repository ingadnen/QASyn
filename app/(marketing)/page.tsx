import Link from "next/link";
import { prisma } from "@/lib/db";
import { resolveOrgContext } from "@/lib/tenant";
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
    key: "bivia",
    kicker: "Bivia Observatory",
    title: "1B-token grant, fully metered.",
    body: "Boolean, choice, ground, score and set decisions stream into a live ledger with confidence and cost saved.",
    accent: "from-emerald-500/15 to-transparent",
    span: "md:col-span-2",
    icon: "🧠",
  },
  {
    key: "strix",
    kicker: "Strix Security",
    title: "OWASP posture on every target.",
    body: "CSP, HSTS, frame protection and cookie posture graded A–F before a release ever ships.",
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
  { tag: "CRAWL", color: "text-quantum-300", title: "Detect the change", body: "QASyn watches deploys and pull requests across every connected repository." },
  { tag: "AUTHOR", color: "text-emerald-300", title: "Run what matters", body: "Impacted tests run first; missing coverage becomes new regression cases." },
  { tag: "HEAL", color: "text-amber-300", title: "Reproduce & explain", body: "Failures and production anomalies are reproduced with traces and a root cause." },
  { tag: "GATE", color: "text-cobalt-300", title: "Report quality", body: "A Release Quality Report scores the build before anyone clicks merge." },
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
      {/* HERO — Obsidian Void */}
      <section className="obsidian-spotlight relative overflow-hidden">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-quantum-500/30 bg-quantum-500/10 px-3 py-1 text-[11px] font-medium text-quantum-200">
              <span className="quantum-pulse size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              🧠 Powered by Articul8 Bivia Multimodal AI · Strix OWASP · Graphify AST
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.6rem]">
              Autonomous Quality Engineering.
              <span className="quantum-text mt-1 block">Grounded in Visual Proof.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              QASyn connects to your code, environments and issue tracker, then crawls, authors, heals and executes every
              change — with a real screenshot on every step and an evidence-backed PR gate before merge.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-gradient-to-r from-quantum-500 via-cobalt-500 to-cobalt-400 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-quantum-500/25 transition hover:brightness-110"
              >
                Launch QASyn Studio →
              </Link>
              <Link
                href="/qasyn"
                className="rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition hover:border-quantum-400/50 hover:bg-white/[0.08]"
              >
                Explore QASyn Agent
              </Link>
              <Link href="/guide" className="px-2 py-3 text-sm font-medium text-slate-400 transition hover:text-quantum-300">
                Interactive User Guide ↗
              </Link>
            </div>
            <p className="mt-6 text-xs text-slate-500">No credit card · 3,000 free credits · Works with localhost · 11 test types</p>
          </div>

          <div className="relative">
            <HeroShowcase />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { k: "Quality score", v: `${score}/100` },
                { k: "Coverage", v: `${report?.latest.coverage ?? 94}%` },
                { k: "Cost avoided", v: formatUsdCompact(report?.latest.costAvoided ?? 18400) },
              ].map((metric) => (
                <div key={metric.k} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{metric.k}</p>
                  <p className="mt-0.5 font-semibold text-white">{metric.v}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] text-slate-500">
              Live from SQLite · {report ? `${report.org} workspace` : "demo data"}
            </p>
            <div className="absolute -bottom-10 -left-6 hidden w-72 rounded-[10px] border border-white/10 bg-[#0b1120] p-4 font-mono text-[11px] leading-relaxed text-slate-400 shadow-2xl shadow-black/60 sm:block">
              <p><span className="text-quantum-300">DEPLOY</span> {report?.latest.version ?? "v2.8.1"} detected</p>
              <p><span className="text-emerald-300">TEST</span> {report?.latest.testsPassed ?? 145}/{report?.latest.testsTotal ?? 148} passed</p>
              <p><span className="text-amber-300">HEAL</span> stale token · auth/refresh.ts:87</p>
              <p><span className="text-cobalt-300">GATE</span> ✅ approved · 3 regressions caught</p>
            </div>
          </div>
        </div>

        {/* Live release ring, integrated into the hero as a precision strip */}
        <div className="relative mx-auto max-w-6xl px-5 pb-14">
          <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl">
            <svg viewBox="0 0 100 100" className="size-16 -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-white/10" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="9"
                strokeLinecap="round"
                className="stroke-quantum-400"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - score / 100)}
              />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-500">Release Quality Report</p>
              <p className="mt-0.5 text-sm font-semibold text-white">
                Release #{report?.latest.release ?? 284} · {report?.latest.version ?? "v2.8.1"} · {score}/100
                <span className="ml-2 text-xs font-medium text-emerald-300">↑ {report?.delta ?? 8} vs previous</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-medium">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">Ready to merge</span>
              <span className="rounded-full border border-quantum-500/30 bg-quantum-500/10 px-3 py-1 text-quantum-200">{report?.latest.regressionsCaught ?? 3} regressions caught</span>
              <span className="rounded-full border border-cobalt-400/30 bg-cobalt-500/10 px-3 py-1 text-cobalt-200">{report?.latest.testsPassed ?? 145}/{report?.latest.testsTotal ?? 148} tests passed</span>
            </div>
          </div>
        </div>
      </section>

      {/* WORDMARKS */}
      <section aria-label="Teams using QASyn (fictional)" className="border-y border-white/5 bg-[#05070e] py-8">
        <p className="text-center text-[10.5px] font-medium uppercase tracking-[0.2em] text-slate-500">
          Trusted by quality-obsessed teams (fictional demo customers)
        </p>
        <div className="relative mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
          <div className="flex w-max animate-marquee gap-16 pr-16">
            {[...CUSTOMER_WORDMARKS, ...CUSTOMER_WORDMARKS].map((name, i) => (
              <span key={`${name}-${i}`} className="font-serif text-2xl text-slate-600" aria-hidden={i >= CUSTOMER_WORDMARKS.length}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* BENTO — Alabaster editorial contrast */}
      <section className="bg-alabaster py-24 text-[#0F172A]">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-quantum-600">Precision by construction</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Six systems. One evidence trail.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Every capability writes back to the same calibre of proof: screenshots, calibrated confidence, audit entries and run metadata.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-6">
            {BENTO.map((card) => (
              <article
                key={card.key}
                className={`group relative overflow-hidden rounded-2xl border border-hairline bg-white p-6 transition hover:-translate-y-0.5 hover:border-quantum-500/40 hover:shadow-xl hover:shadow-slate-900/5 ${card.span}`}
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${card.accent} opacity-70`} aria-hidden="true" />
                <span className="relative flex size-10 items-center justify-center rounded-xl border border-hairline bg-white text-lg shadow-sm">{card.icon}</span>
                <p className="relative mt-4 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-quantum-600">{card.kicker}</p>
                <h3 className="relative mt-1.5 text-lg font-semibold tracking-tight">{card.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-slate-600">{card.body}</p>
              </article>
            ))}
            <article className="group relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-[#0B1120] to-[#111A2E] p-6 text-white md:col-span-6 lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-xl">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-quantum-300">Enterprise Multi-Tenant</p>
                  <h3 className="mt-1.5 text-lg font-semibold tracking-tight">Super Admin provisioning, in one modal.</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Provision an Enterprise tenant, grant Bivia credits to the ledger, seed Production + Staging, and configure website, seats, SSO and SLA — with AES-256-GCM secret encryption.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                  {["Enterprise plan", "Custom credits", "SSO/SAML", "Dedicated admin", "System audit"].map((chip) => (
                    <span key={chip} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-300">{chip}</span>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* AQE LOOP + METRICS */}
      <section className="bg-obsidian-900 text-white">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold text-quantum-300">The autonomous loop</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                An AI QA engineer that <span className="font-serif font-normal italic text-quantum-300">never sleeps.</span>
              </h2>
              <p className="mt-4 text-slate-400">
                QASyn runs the full loop on every release, then writes everything back to your tools — PR comments, Jira tickets,
                Slack alerts.
              </p>
              <Link href="/qasyn" className="mt-8 inline-flex rounded-full bg-gradient-to-r from-quantum-500 to-cobalt-400 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110">
                Explore QASyn Agent →
              </Link>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {LOOP.map((step, i) => (
                <li key={step.tag} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
      <section className="bg-alabaster py-24 text-[#0F172A]">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Loved by teams that <span className="font-serif font-normal italic text-quantum-600">ship daily</span>
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">Illustrative quotes from fictional demo customers.</p>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="flex flex-col rounded-2xl border border-hairline bg-white p-6">
                <p className="text-signal-amber" aria-label="5 out of 5">★★★★★</p>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">“{t.quote}”</blockquote>
                <figcaption className="mt-5 border-t border-hairline pt-4 text-sm">
                  <span className="font-semibold">{t.name}</span>
                  <span className="block text-xs text-slate-500">{t.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#06080f] px-5 py-24">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-quantum-500/20 via-cobalt-500/15 to-transparent px-8 py-14 text-center sm:px-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(6,182,212,0.22),transparent_70%)]" />
          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Your next release, <span className="font-serif font-normal italic text-quantum-300">already tested.</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-slate-300">
            Create an organisation, connect a repository, and watch QASyn run its first analysis.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0B1120] hover:bg-quantum-100">
              Start free
            </Link>
            <Link href="/guide" className="rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/10">
              Open the interactive guide
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
