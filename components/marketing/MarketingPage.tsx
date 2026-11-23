/**
 * Shared marketing page renderer: light Precision Workspace hero, capability
 * bento, workflow steps, FAQ and CTA — driven by a small typed content object.
 * Used by every /platform, /solutions, /integrations and company page, so the
 * Precision Workspace palette propagates to every marketing subpage.
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
  const detailedFeatures = (() => {
    const existing = data.features.map((feature) => ({
      title: feature.title,
      body: /Available in the QASyn platform today/i.test(feature.body) || feature.body.trim().length < 60
        ? `${feature.title} is executed by QASyn's autonomous agents for ${data.title.toLowerCase()}. Each run captures per-step PNG evidence, DOM context, calibrated confidence and an immutable audit record.`
        : feature.body,
    }));
    const fallback: Array<{ title: string; body: string }> = [
      { title: "Evidence-first execution", body: `Every ${data.title.toLowerCase()} step runs in a real browser and persists a full-resolution screenshot plus expected-result metadata. Failures are reproducible from the same run record.` },
      { title: "QASyn Vision AI verification", body: "Visual assertions are calibrated by QASyn Vision AI with an abstention path, confidence score and locator grounding. Ambiguous evidence is escalated instead of guessed." },
      { title: "Bidirectional workflow sync", body: "QASyn syncs pull requests, requirements, suites and test cases with GitHub, GitLab and Azure DevOps. Workspace results flow back to the tools your team already uses." },
      { title: "Governed AI execution", body: "Workspace admins choose models, allocate token quotas and publish agent skills. Every AI decision is metered against the organisation ledger and visible in telemetry." },
      { title: "Enterprise controls", body: "Role-based access, SSO-ready identity, audit exports, private browser grids and retention controls keep quality data inside your governance boundary." },
      { title: "Release quality intelligence", body: "Blast-radius analysis, PR gate verdicts and release reports connect every change to the exact tests, evidence and business risk it introduced." },
    ];
    const merged = [...existing];
    for (const item of fallback) {
      if (merged.length >= 6) break;
      if (!merged.some((feature) => feature.title.toLowerCase() === item.title.toLowerCase())) merged.push(item);
    }
    return merged.slice(0, 6);
  })();

  const architecture = [
    `Connect QASyn to the systems that describe ${data.title.toLowerCase()}: repositories, environments, issue trackers and identity.`,
    "Crawl the live application, map DOM flows and author target-specific test cases with QASyn Vision AI grounding.",
    "Execute in a real Playwright browser and capture step PNGs, traces, network failures and calibrated visual decisions.",
    "Gate the release with impact analysis, self-healing retries and a signed quality report before merge.",
  ];

  const faqs = data.faqs && data.faqs.length >= 2 ? data.faqs : [
    { q: `How does QASyn implement ${data.title}?`, a: `It combines live crawling, agent-authored cases, QASyn Vision AI grounding and deterministic Playwright execution. Every run persists screenshot evidence and audit metadata for ${data.title.toLowerCase()}.` },
    { q: "Does it work with our existing CI/CD?", a: "Yes. QASyn exposes PR gates, webhooks, API tokens and MCP tools so GitHub, GitLab, Azure DevOps, Jenkins and AI coding agents can trigger and consume results." },
    { q: "Can we keep our own AI model?", a: "Team and Enterprise admins can add OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Azure OpenAI or a custom OpenAI-compatible endpoint." },
    { q: "How is evidence retained?", a: "Run evidence is stored with the test case and TestCaseRun history. Workspace roles and audits control who can inspect, export or delete it." },
  ];
  return (
    <div className="bg-[#FAFAF7] text-pw-ink">
      <section className="obsidian-spotlight relative overflow-hidden border-b border-pw-line">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 py-16">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-brand-600">{data.kicker}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-pw-heading sm:text-4xl">{data.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-pw-muted">{data.lede}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
            >
              Start free
            </Link>
            <Link href="/contact-us" className="rounded-full border border-pw-line bg-white px-5 py-2.5 text-sm font-semibold text-pw-heading transition hover:border-brand-400 hover:text-brand-700">
              Book a demo
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#FAFAF7] py-16 text-pw-ink">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {detailedFeatures.map((f) => (
              <article key={f.title} className="rounded-lg border border-pw-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lg hover:shadow-black/5">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-50 text-sm text-brand-700" aria-hidden="true">
                  ✓
                </span>
                <h2 className="mt-3 text-sm font-semibold text-pw-heading">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-pw-muted">{f.body}</p>
              </article>
            ))}
          </div>

          {data.sections?.map((s) => (
            <section key={s.heading} className="mt-12">
              <h2 className="text-xl font-semibold text-pw-heading">{s.heading}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-pw-muted">{s.body}</p>
            </section>
          ))}

          <section className="mt-14">
            <h2 className="text-xl font-semibold text-pw-heading">Architecture &amp; workflow</h2>
            <p className="mt-2 max-w-3xl text-sm text-pw-muted">How QASyn executes {data.title.toLowerCase()} end-to-end.</p>
            <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {architecture.map((step, index) => (
                <li key={step} className="rounded-lg border border-pw-line bg-white p-4">
                  <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{index + 1}</span>
                  <p className="mt-2 text-sm leading-relaxed text-pw-muted">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-14">
            <h2 className="text-xl font-semibold text-pw-heading">QASyn autonomous agents vs. legacy scripts and recorders</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-pw-line bg-white">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead className="bg-pw-bg text-[10.5px] uppercase tracking-wide text-pw-muted"><tr><th className="px-3 py-2">Dimension</th><th className="px-3 py-2">QASyn autonomous agents</th><th className="px-3 py-2">Legacy scripts / recorders</th></tr></thead>
                <tbody>
                  {[
                    ["Authoring", "Crawl the live DOM and generate target-specific cases", "Hand-written selectors and brittle recordings"],
                    ["Maintenance", "QASyn Vision AI re-grounds selectors with abstention control", "Manual selector repair after every UI change"],
                    ["Evidence", "Real per-step PNG, expected result and audit metadata", "Screenshots bolted on after failures"],
                    ["Release decision", "Impact analysis, PR gate and calibrated risk score", "Pass/fail output with no blast-radius context"],
                    ["Governance", "Model, token and skill controls per workspace", "Shared credentials and no usage telemetry"],
                  ].map(([dimension, qasyn, legacy]) => (
                    <tr key={dimension} className="border-t border-pw-line"><td className="px-3 py-2 font-semibold text-pw-heading">{dimension}</td><td className="px-3 py-2 text-[#3b4a53]">✓ {qasyn}</td><td className="px-3 py-2 text-pw-muted">{legacy}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-14 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="marketing-kpi-strip">
            {[
              ["Quality score", "96/100"],
              ["Coverage", "94%"],
              ["Faster triage", "4.2×"],
              ["Manual QA avoided", "$24.8K"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-pw-line bg-white p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-pw-muted">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-pw-heading">{value}</p>
              </div>
            ))}
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-semibold text-pw-heading">Frequently asked questions</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {faqs.map((f) => (
                <li key={f.q} className="rounded-lg border border-pw-line bg-white p-4">
                  <p className="text-sm font-semibold text-pw-heading">{f.q}</p>
                  <p className="mt-1 text-sm text-pw-muted">{f.a}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 py-16">
        <div className="relative overflow-hidden rounded-lg border border-pw-line bg-obsidian-950 p-8">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(15,107,92,0.35),transparent_70%)]" />
          <h2 className="relative text-xl font-semibold text-white">See QASyn test your application in 30 minutes</h2>
          <p className="relative mt-2 text-sm text-slate-300">Autonomous quality engineering, grounded in visual proof. Crawl, author, heal and gate every release.</p>
          <div className="relative mt-5 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400">
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
