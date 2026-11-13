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
    <footer className="border-t border-white/10 bg-[#05070e] text-slate-400">
      <div className="mx-auto max-w-[1440px] px-6 sm:px-8 lg:px-12 pt-14">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-quantum-500/10 via-cobalt-500/10 to-transparent px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300">
              <span className="quantum-pulse size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" aria-hidden="true" />
              All 19 QASyn Modules Operational · QASyn Vision AI Active
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              {QUICK_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 transition hover:border-quantum-400/50 hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1440px] gap-10 px-6 sm:px-8 lg:px-12 py-12 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
        <div>
          <Logo inverted />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
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
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-quantum-400/60 focus:outline-none"
            />
            <button type="submit" className="rounded-full bg-gradient-to-r from-quantum-500 to-cobalt-400 px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
              Join
            </button>
          </form>
          <p className="mt-2 text-[11px] uppercase tracking-widest text-slate-500">The QA Brief · monthly</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-400">
            <span className="rounded-md border border-white/15 px-2 py-1">ISO 27001</span>
            <span className="rounded-md border border-white/15 px-2 py-1">SOC 2 Type II</span>
            <span className="rounded-md border border-white/15 px-2 py-1">GDPR</span>
          </div>
          <button type="button" className="mt-3 rounded-full border border-white/15 px-3 py-1 text-xs text-slate-400 hover:text-white">
            Cookie preferences
          </button>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-500">{col.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-slate-400 transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-2 px-6 sm:px-8 lg:px-12 py-5 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} QASyn — local prototype, not affiliated with any vendor.</span>
          <span>Next.js 15 · Prisma · SQLite · QASyn Vision AI</span>
        </div>
      </div>
    </footer>
  );
}
