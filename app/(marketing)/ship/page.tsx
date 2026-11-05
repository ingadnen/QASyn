import type { Metadata } from "next";
import Link from "next/link";
import { PricingGrid } from "@/components/marketing/ship/PricingGrid";
import { RiskAnalysis } from "@/components/marketing/ship/RiskAnalysis";
import { ShipTerminal, type TerminalLine } from "@/components/marketing/ship/ShipTerminal";
import { libreCaslon, publicSans } from "@/lib/fonts";
import { CREDIT_COSTS, KEY_METRICS } from "@/lib/marketing";
import { RELEASE_TEMPLATES, buildRunLogs } from "@/lib/mockData";

export const metadata: Metadata = { title: "Ship — your autonomous AI QA engineer" };

const WORKFLOWS = [
  {
    kicker: "01 · Change intelligence",
    title: "Every PR, mapped to the flows it can break.",
    body: "Ship reads the diff, builds a blast radius and runs only the impacted tests — then writes the missing ones.",
  },
  {
    kicker: "02 · Investigations",
    title: "Bug reports become reproductions with a root cause.",
    body: "Point Ship at a Jira or Linear ticket: it reproduces the bug, captures a trace and suggests the fix.",
  },
  {
    kicker: "03 · Production signals",
    title: "Anomalies in prod become tests in CI.",
    body: "Repeated payment attempts or login loops are replayed, reproduced and added to the regression suite.",
  },
];

const FAQ = [
  { q: "What is a credit?", a: "A unit of work: one test run consumes 1 credit per 4 steps, a PR impact analysis 10 credits, a bug analysis 15 credits." },
  { q: "Can Ship test localhost?", a: "Yes. Install the tunnel from onboarding step 2 — it opens an outbound-only connection with a tnl_ token, no inbound ports." },
  { q: "Do unused credits roll over?", a: "In this prototype credits are simulated; the Enterprise plan supports pooled credits across teams." },
  { q: "Is my code sent anywhere?", a: "Not in this prototype: all analysis is mocked locally and stored in SQLite." },
];

/** Logs déterministes (heure UTC formatée côté serveur → pas d'écart d'hydratation). */
function terminalLines(): TerminalLine[] {
  const template = RELEASE_TEMPLATES.at(-1)!;
  return buildRunLogs(template, 284, "acme / storefront", new Date(Date.UTC(2026, 0, 12, 9, 41, 0)))
    .slice(1)
    .map((l) => ({ time: l.timestamp.toISOString().slice(11, 19), tag: l.tag, message: l.message, stream: l.stream }));
}

export default function ShipPage() {
  return (
    <div className={`${libreCaslon.variable} ${publicSans.variable} bg-paper font-public text-paper-ink`}>
      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 lg:grid-cols-[1fr_1.15fr] lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-paper-line bg-white px-3 py-1 text-xs font-semibold text-paper-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-ember-500" /> Ship · AQE agent
          </span>
          <h1 className="mt-6 font-caslon text-5xl leading-[1.05] text-paper-ink sm:text-6xl">
            Ship is your autonomous <em className="text-ember-500">AI QA engineer.</em>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper-muted">
            It watches every deploy, tests what changed, reproduces bugs from your tracker and turns production anomalies into
            regression tests — from a single command.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/onboard/organisation" className="rounded-full bg-ember-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-ember-600">
              Start free
            </Link>
            <a href="#pricing" className="rounded-full border border-paper-ink px-6 py-3 text-sm font-semibold text-paper-ink transition hover:bg-paper-ink hover:text-white">
              See pricing
            </a>
          </div>
          <p className="mt-6 font-mono text-xs text-paper-muted">$ npm i -g @qasyn/ship &amp;&amp; ship watch --all</p>
        </div>
        <ShipTerminal lines={terminalLines()} />
      </section>

      {/* METRICS */}
      <section className="border-y border-paper-line bg-paper-card/50">
        <dl className="mx-auto grid max-w-6xl gap-px px-5 sm:grid-cols-2 lg:grid-cols-4">
          {KEY_METRICS.map((m) => (
            <div key={m.label} className="px-4 py-10 text-center">
              <dt className="sr-only">{m.label}</dt>
              <dd className="font-caslon text-5xl text-paper-ink">{m.value}</dd>
              <p className="mt-2 text-sm text-paper-muted">{m.label}</p>
            </div>
          ))}
        </dl>
      </section>

      {/* WORKFLOWS */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="max-w-2xl font-caslon text-4xl text-paper-ink">Three workflows. One agent that never forgets a regression.</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {WORKFLOWS.map((w) => (
            <article key={w.kicker} className="rounded-[15px] border border-paper-line bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-ember-500">{w.kicker}</p>
              <h3 className="mt-4 font-caslon text-xl leading-snug text-paper-ink">{w.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-paper-muted">{w.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* RISK ANALYSIS */}
      <section className="bg-paper-card/50 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-ember-500">Release risk analysis</p>
            <h2 className="mt-3 font-caslon text-4xl text-paper-ink">Know the blast radius before you merge.</h2>
            <p className="mt-3 text-paper-muted">Pick a pull request to see which business flows it touches and how Ship scores the risk.</p>
          </div>
          <div className="mt-10">
            <RiskAnalysis />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-ember-500">Pricing</p>
          <h2 className="mt-3 font-caslon text-4xl text-paper-ink">Pay for the quality work Ship actually does.</h2>
          <p className="mt-3 text-paper-muted">Simple credit-based plans. Move the sliders to find the best fit for your team.</p>
        </div>
        <div className="mt-10">
          <PricingGrid />
        </div>
        <div className="mt-12 overflow-hidden rounded-[15px] border border-paper-line bg-white">
          <table className="w-full text-left text-sm">
            <caption className="px-5 pt-5 text-left font-caslon text-xl text-paper-ink">Credit costs</caption>
            <thead>
              <tr className="text-xs uppercase tracking-widest text-paper-muted">
                <th scope="col" className="px-5 py-3 font-semibold">Action</th>
                <th scope="col" className="px-5 py-3 font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_COSTS.map((c) => (
                <tr key={c.action} className="border-t border-paper-line">
                  <td className="px-5 py-3 text-paper-ink">{c.action}</td>
                  <td className="px-5 py-3 font-mono text-xs text-paper-muted">{c.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 pb-24">
        <h2 className="font-caslon text-3xl text-paper-ink">Questions</h2>
        <div className="mt-6 divide-y divide-paper-line border-y border-paper-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-paper-ink">
                {f.q}
                <span className="text-ember-500 transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
