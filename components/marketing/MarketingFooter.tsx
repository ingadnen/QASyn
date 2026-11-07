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
      { href: "/why-contextqa", label: "Why ContextQA" },
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

export function MarketingFooter() {
  return (
    <footer className="bg-navy-950 text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
        <div>
          <Logo inverted />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            The agentic AI testing platform. One place to write, heal, and run tests across web, mobile, API, and AI agents.
          </p>
          <form className="mt-6 flex max-w-xs gap-2" action="/signup">
            <label htmlFor="footer-email" className="sr-only">
              Work email
            </label>
            <input
              id="footer-email"
              type="email"
              placeholder="you@company.com"
              className="min-w-0 flex-1 rounded-full bg-white/5 px-4 py-2 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-brand-400 focus:outline-none"
            />
            <button type="submit" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500">
              Join
            </button>
          </form>
          <p className="mt-2 text-[11px] uppercase tracking-widest text-slate-500">The QA Brief · monthly</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            All Systems Operational
          </p>
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
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{col.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-5 py-5 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} QASyn — local prototype, not affiliated with any vendor.</span>
          <span>Next.js 15 · Prisma · SQLite</span>
        </div>
      </div>
    </footer>
  );
}
