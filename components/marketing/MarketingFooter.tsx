import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { href: "/platform/at-a-glance", label: "At a Glance" },
      { href: "/platform/ai-agents-testing", label: "AI Agents Testing" },
      { href: "/platform/enterprise-apps-testing", label: "Enterprise Apps" },
      { href: "/platform/ai-based-self-healing", label: "Self-Healing" },
      { href: "/platform/code-export", label: "CodiTOS Export" },
      { href: "/platform/mcp", label: "MCP Server" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { href: "/solutions/web-automation", label: "Web Automation" },
      { href: "/solutions/mobile-testing", label: "Mobile Testing" },
      { href: "/solutions/api-testing", label: "API Testing" },
      { href: "/solutions/salesforce-testing", label: "Salesforce" },
      { href: "/solutions/security-testing", label: "Security Testing" },
      { href: "/solutions/voice-agent-testing", label: "Voice Agents" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/learning", label: "Learning Hub" },
      { href: "/blog", label: "Blog" },
      { href: "/case-study", label: "Case Studies" },
      { href: "/roi-calculator", label: "ROI Calculator" },
      { href: "/podcast", label: "Podcast" },
      { href: "/academy", label: "Academy" },
      { href: "/glossary", label: "Glossary" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about-us", label: "About Us" },
      { href: "/why-qasyn", label: "Why QASyn" },
      { href: "/careers", label: "Careers" },
      { href: "/partner-program", label: "Partner Program" },
      { href: "/pilot-program", label: "Pilot Program" },
      { href: "/faqs", label: "FAQs" },
      { href: "/contact-us", label: "Contact Us" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms-of-service", label: "Terms of Service" },
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/data-privacy-policy", label: "Data Privacy" },
      { href: "/data-processing-agreement", label: "DPA (GDPR/CCPA)" },
      { href: "/cookie-policy", label: "Cookie Policy" },
    ],
  },
];

const QUICK_LINKS = [
  { href: "/qasyn", label: "QASyn Agent" },
  { href: "/pricing", label: "Pricing" },
  { href: "/platform", label: "Platform" },
  { href: "/roi-calculator", label: "ROI Calculator" },
  { href: "/dashboard/learning", label: "Learning Hub" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-pw-line bg-white text-[#3b4a53]">
      <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 pt-14">
        <div className="rounded-lg border border-pw-line bg-pw-bg px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-brand-700">
              <span className="quantum-pulse size-1.5 rounded-full bg-brand-500 shadow-[0_0_10px_rgba(15,107,92,0.45)]" aria-hidden="true" />
              All 19 QASyn Modules Operational · QASyn Vision AI Active
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              {QUICK_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-full border border-pw-line bg-white px-2.5 py-1 text-[#3b4a53] transition hover:border-brand-400 hover:text-brand-700">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1440px] gap-10 px-6 sm:px-8 lg:px-12 py-12 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-pw-muted">
            Autonomous quality engineering, grounded in visual proof. One platform to crawl, author, heal, execute and gate every release across web, mobile, API and AI agents.
          </p>
          <form className="mt-6 flex max-w-xs gap-2" action="/signup">
            <label htmlFor="footer-email" className="sr-only">
              Work email
            </label>
            <input
              id="footer-email"
              type="email"
              placeholder="you@company.com"
              className="min-w-0 flex-1 rounded-full border border-pw-line bg-white px-4 py-2 text-sm text-pw-ink placeholder:text-[#8a979e] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <button type="submit" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500">
              Join
            </button>
          </form>
          <p className="mt-2 text-[11px] uppercase tracking-widest text-pw-muted">The QA Brief · monthly</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-[#3b4a53]">
            <span className="rounded-md border border-pw-line px-2 py-1">ISO 27001</span>
            <span className="rounded-md border border-pw-line px-2 py-1">SOC 2 Type II</span>
            <span className="rounded-md border border-pw-line px-2 py-1">GDPR</span>
          </div>
          <button type="button" className="mt-3 rounded-full border border-pw-line px-3 py-1 text-xs text-[#3b4a53] hover:text-brand-700">
            Cookie preferences
          </button>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-pw-muted">{col.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[#3b4a53] transition hover:text-brand-700">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-pw-line">
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-2 px-6 sm:px-8 lg:px-12 py-5 text-xs text-pw-muted">
          <span>© {new Date().getFullYear()} QASyn Inc. All rights reserved.</span>
          <span>Autonomous AI Quality Engineering · Enterprise SaaS</span>
        </div>
      </div>
    </footer>
  );
}
