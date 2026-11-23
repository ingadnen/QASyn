import type { Metadata } from "next";
import Link from "next/link";
import { PricingGrid } from "@/components/marketing/qasyn/PricingGrid";
import { RiskAnalysis } from "@/components/marketing/qasyn/RiskAnalysis";
import { QasynTerminal, type TerminalLine } from "@/components/marketing/qasyn/QasynTerminal";
import { CREDIT_COSTS, KEY_METRICS } from "@/lib/marketing";
import { RELEASE_TEMPLATES, buildRunLogs } from "@/lib/mockData";

export const metadata: Metadata = { title: "QASyn — your autonomous AI QA engineer" };

const WORKFLOWS = [
  {
    kicker: "01 · Change intelligence",
    title: "Every PR, mapped to the flows it can break.",
    body: "QASyn reads the diff, builds a blast radius and runs only the impacted tests — then writes the missing ones.",
    icon: "🧭",
  },
  {
    kicker: "02 · Investigations",
    title: "Bug reports become reproductions with a root cause.",
    body: "Point QASyn at a Jira or Linear ticket: it reproduces the bug, captures a trace and suggests the fix.",
    icon: "🔬",
  },
  {
    kicker: "03 · Production signals",
    title: "Anomalies in prod become tests in CI.",
    body: "Repeated payment attempts or login loops are replayed, reproduced and added to the regression suite.",
    icon: "📡",
  },
];

const FAQ = [
  { q: "What is a credit?", a: "A unit of work: one test run consumes 1 credit per 4 steps, a PR impact analysis 10 credits, a bug analysis 15 credits." },
  { q: "Can QASyn test localhost?", a: "Yes. Install the tunnel from onboarding step 2 — it opens an outbound-only connection with a tnl_ token, no inbound ports." },
  { q: "Do unused credits roll over?", a: "Unused credits follow your plan terms, and the Enterprise plan supports pooled credits across teams." },
  { q: "Is my code sent anywhere?", a: "No. Analysis runs inside your workspace and results stay in your organisation's data boundary; private deployment is available for Enterprise." },
];

/** Logs déterministes (heure UTC formatée côté serveur → pas d'écart d'hydratation). */
function terminalLines(): TerminalLine[] {
  const template = RELEASE_TEMPLATES.at(-1)!;
  return buildRunLogs(template, 284, "acme / storefront", new Date(Date.UTC(2026, 0, 12, 9, 41, 0)))
    .slice(1)
    .map((l) => ({ time: l.timestamp.toISOString().slice(11, 19), tag: l.tag, message: l.message, stream: l.stream }));
}

export default function QasynPage() {
  return (
    <div className="bg-[#FAFAF7] text-pw-ink">
      {/* HERO */}
      <section className="obsidian-spotlight relative overflow-hidden border-b border-pw-line">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-6 sm:px-8 lg:px-12 pb-20 pt-16 lg:grid-cols-[1fr_1.15fr] lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
              <span className="quantum-pulse size-1.5 rounded-full bg-brand-500" /> ⚡ QASyn · Autonomous Quality Engineer
            </span>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.04] tracking-tight text-pw-heading sm:text-6xl">
              QASyn is your autonomous <em className="quantum-text not-italic">AI QA engineer.</em>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-pw-muted">
              It watches every deploy, tests what changed, reproduces bugs from your tracker and turns production anomalies into
              regression tests — from a single command.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
              >
                Start free
              </Link>
              <a
                href="#pricing"
                className="rounded-full border border-pw-line bg-white px-6 py-3 text-sm font-semibold text-pw-heading transition hover:border-brand-400 hover:text-brand-700"
              >
                See pricing
              </a>
              <Link href="/contact-us" className="px-2 py-3 text-sm font-medium text-pw-muted transition hover:text-brand-700">
                Talk to sales
              </Link>
            </div>
            <p className="mt-6 font-mono text-xs text-pw-muted">$ npm i -g @qasyn/cli &amp;&amp; qasyn watch --all</p>
          </div>
          <QasynTerminal lines={terminalLines()} />
        </div>
      </section>

      {/* METRICS */}
      <section className="border-b border-pw-line bg-white">
        <dl className="mx-auto grid max-w-[1440px] gap-px px-6 sm:px-8 lg:px-12 sm:grid-cols-2 lg:grid-cols-4">
          {KEY_METRICS.map((m) => (
            <div key={m.label} className="px-4 py-10 text-center">
              <dt className="sr-only">{m.label}</dt>
              <dd className="font-serif text-5xl tabular-nums text-pw-heading">{m.value}</dd>
              <p className="mt-2 text-sm text-pw-muted">{m.label}</p>
            </div>
          ))}
        </dl>
      </section>

      {/* WORKFLOWS */}
      <section className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 py-24">
        <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-pw-heading">Three workflows. One agent that never forgets a regression.</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {WORKFLOWS.map((w) => (
            <article key={w.kicker} className="group rounded-lg border border-pw-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lg hover:shadow-black/5">
              <span className="flex size-10 items-center justify-center rounded-lg border border-pw-line bg-pw-bg text-lg">{w.icon}</span>
              <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-brand-600">{w.kicker}</p>
              <h3 className="mt-2 text-xl font-semibold leading-snug text-pw-heading">{w.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-pw-muted">{w.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* RISK ANALYSIS */}
      <section className="border-y border-pw-line bg-white py-24">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-brand-600">Release risk analysis</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-pw-heading">Know the blast radius before you merge.</h2>
            <p className="mt-3 text-pw-muted">Pick a pull request to see which business flows it touches and how QASyn scores the risk.</p>
          </div>
          <div className="mt-10">
            <RiskAnalysis />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-[1440px] scroll-mt-24 px-6 sm:px-8 lg:px-12 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-brand-600">Pricing</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-pw-heading">Pay for the quality work QASyn actually does.</h2>
          <p className="mt-3 text-pw-muted">Simple credit-based plans. Move the sliders to find the best fit for your team.</p>
        </div>
        <div className="mt-10">
          <PricingGrid />
        </div>
        <div className="mt-12 overflow-hidden rounded-lg border border-pw-line bg-white">
          <table className="w-full text-left text-sm">
            <caption className="px-5 pt-5 text-left text-xl font-semibold text-pw-heading">Credit costs</caption>
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.18em] text-pw-muted">
                <th scope="col" className="px-5 py-3 font-semibold">Action</th>
                <th scope="col" className="px-5 py-3 font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_COSTS.map((c) => (
                <tr key={c.action} className="border-t border-pw-line">
                  <td className="px-5 py-3 text-[#3b4a53]">{c.action}</td>
                  <td className="px-5 py-3 font-mono text-xs tabular-nums text-pw-muted">{c.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 pb-24">
        <h2 className="text-3xl font-semibold tracking-tight text-pw-heading">Questions</h2>
        <div className="mt-6 divide-y divide-pw-line border-y border-pw-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-pw-heading">
                {f.q}
                <span className="text-brand-600 transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-pw-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
