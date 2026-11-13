import type { Metadata } from "next";
import Link from "next/link";
import { PricingCalculator } from "@/components/marketing/PricingCalculator";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  { key: "trial", name: "Free Pilot", price: "$0", cadence: "/ 12 weeks", blurb: "Validate QASyn on one product with 3,000 AI credits and unlimited seats.", cta: "Start Free Pilot", href: "/signup?plan=trial", features: ["3,000 AI credits", "12-week pilot", "Crawl + test authoring", "Per-step PNG evidence", "Community support"] },
  { key: "starter", name: "Starter", price: "$99", cadence: "/ month", blurb: "For one QA team shipping weekly with autonomous regression.", cta: "Start Team Trial", href: "/signup?plan=starter", features: ["20,000 AI credits / month", "5 seats", "PR impact analysis", "QASyn Vision AI verification", "Email support"] },
  { key: "pro", name: "Team / Pro", price: "$299", cadence: "/ month", blurb: "Most popular: cross-team quality engineering with governance and MCP.", cta: "Choose Team Plan", href: "/signup?plan=pro", popular: true, features: ["120,000 AI credits / month", "Unlimited seats", "Azure DevOps / GitHub / GitLab sync", "Custom AI models & agent skills", "Token allocation per user", "Priority support"] },
  { key: "enterprise", name: "Enterprise", price: "Custom", cadence: "SLA", blurb: "For regulated enterprises needing SSO, private execution and custom SLAs.", cta: "Talk to Sales", href: "/contact-us?plan=enterprise", features: ["Custom credit pool", "SSO / SCIM / audit exports", "Private browser grid", "Dedicated success architect", "99.95% SLA", "Invoice / PO"] },
];

const MODULES = [
  "Overview", "Pull requests", "Crawl", "Code Analysis", "Requirements", "Test cases", "Test Studio",
  "Suites & Plans", "Environments & Data", "Uploads", "Knowledge Base", "Team & access", "Tunnels",
  "Integrations", "Billing & usage", "MCP", "API Tokens", "System Audits", "Learning Hub",
];

const MATRIX = [
  { label: "AI credits / month", trial: "3K", starter: "20K", pro: "120K", enterprise: "Custom" },
  { label: "Seats", trial: "Unlimited", starter: "5", pro: "Unlimited", enterprise: "Custom" },
  { label: "Crawl + Autopilot", trial: "✓", starter: "✓", pro: "✓", enterprise: "✓" },
  { label: "QASyn Vision AI verification", trial: "✓", starter: "✓", pro: "✓", enterprise: "✓" },
  { label: "PR gate + Azure DevOps sync", trial: "—", starter: "✓", pro: "✓", enterprise: "✓" },
  { label: "Custom AI models / skills", trial: "—", starter: "—", pro: "✓", enterprise: "✓" },
  { label: "SSO / SCIM / private grid", trial: "—", starter: "—", pro: "—", enterprise: "✓" },
  { label: "Support", trial: "Community", starter: "Email", pro: "Priority", enterprise: "Dedicated + SLA" },
];

const FAQS = [
  { q: "What counts as an AI credit?", a: "A crawl page, a generated test case, an AI assertion, a locator heal or a PR impact analysis consumes credits. Every ledger entry is visible in Billing & usage." },
  { q: "Can I buy more credits later?", a: "Yes. Workspace admins can top up 50K, 250K or 1M credits instantly from Billing, with card, PayPal or invoice." },
  { q: "Is the free pilot really free?", a: "Yes — 12 weeks and 3,000 credits with no payment method. Your tests and evidence remain when you upgrade." },
  { q: "Do you support Azure DevOps?", a: "Yes. QASyn syncs Pull Requests, Boards work items, Test Plans, suites and TCM test cases bidirectionally." },
  { q: "Can I bring my own model?", a: "Team and Enterprise workspaces can add OpenAI, Claude, Gemini, DeepSeek, Azure OpenAI or a custom compatible endpoint." },
  { q: "How is billing reconciled?", a: "Every grant, charge and refund is a CreditEntry row with an audit record. Invoices and PO references are stored on the organisation." },
];

export default function PricingPage() {
  return (
    <div className="bg-[#06080f] text-slate-100">
      <section className="obsidian-spotlight relative overflow-hidden border-b border-white/5">
        <div className="quantum-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1440px] px-6 py-16 sm:px-8 lg:px-12">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-quantum-300">PRICING</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Autonomous quality engineering, priced for every stage.</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400">Start with a 12-week free pilot, scale to a team plan, or run QASyn privately with enterprise governance.</p>
        </div>
      </section>

      <section className="bg-alabaster py-16 text-[#0F172A]">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan) => (
              <article key={plan.key} data-testid={`pricing-tier-${plan.key}`} className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${plan.popular ? "border-quantum-500 ring-2 ring-quantum-500/20" : "border-hairline"}`}>
                {plan.popular && <span className="absolute -top-3 left-5 rounded-full bg-quantum-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">MOST POPULAR</span>}
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <p className="mt-2"><span className="text-3xl font-semibold">{plan.price}</span> <span className="text-xs text-slate-500">{plan.cadence}</span></p>
                <p className="mt-2 min-h-[48px] text-sm leading-relaxed text-slate-600">{plan.blurb}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-[12.5px] text-slate-600">
                  {plan.features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-quantum-600">✓</span>{feature}</li>)}
                </ul>
                <Link href={plan.href} className={`mt-5 inline-flex h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold ${plan.popular ? "bg-quantum-600 text-white hover:bg-quantum-500" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>{plan.cta}</Link>
              </article>
            ))}
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="rounded-2xl border border-hairline bg-white p-5">
              <h2 className="text-xl font-semibold">Full feature comparison</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[12px]" data-testid="pricing-comparison">
                  <thead><tr className="border-b border-slate-200 text-[10.5px] uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Capability</th><th className="px-2 py-2">Free Pilot</th><th className="px-2 py-2">Starter</th><th className="px-2 py-2">Team / Pro</th><th className="px-2 py-2">Enterprise</th></tr></thead>
                  <tbody>{MATRIX.map((row) => <tr key={row.label} className="border-b border-slate-100"><td className="px-2 py-2 font-medium text-slate-800">{row.label}</td><td className="px-2 py-2">{row.trial}</td><td className="px-2 py-2">{row.starter}</td><td className="px-2 py-2">{row.pro}</td><td className="px-2 py-2">{row.enterprise}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl border border-hairline bg-white p-5">
              <h2 className="text-xl font-semibold">All 19 modules included</h2>
              <p className="mt-2 text-sm text-slate-600">Every plan unlocks the complete platform surface. Limits apply only to AI credits, seats and enterprise controls.</p>
              <div className="mt-4 grid grid-cols-2 gap-1.5 text-[12px] text-slate-600 sm:grid-cols-3">
                {MODULES.map((module) => <span key={module} className="rounded-md bg-slate-50 px-2 py-1.5">✓ {module}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-14 sm:px-8 lg:px-12">
        <PricingCalculator />
      </section>

      <section className="bg-alabaster py-16 text-[#0F172A]">
        <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12">
          <h2 className="text-2xl font-semibold">Pricing FAQs</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {FAQS.map((faq) => <article key={faq.q} className="rounded-2xl border border-hairline bg-white p-4"><h3 className="text-sm font-semibold">{faq.q}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{faq.a}</p></article>)}
          </div>
        </div>
      </section>
    </div>
  );
}
