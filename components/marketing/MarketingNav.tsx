"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

interface MenuLink {
  href: string;
  label: string;
  badge?: string;
}
interface MenuColumn {
  title: string;
  links: MenuLink[];
}
interface Menu {
  label: string;
  href: string;
  columns: MenuColumn[];
  promo: { kicker: string; title: string; body: string; cta: string; href: string };
}

const MENUS: Menu[] = [
  {
    label: "Platform",
    href: "/platform",
    columns: [
      {
        title: "What you test",
        links: [
          { href: "/platform/ai-agents-testing", label: "AI Agent", badge: "New" },
          { href: "/platform/enterprise-apps-testing", label: "Enterprise Apps" },
          { href: "/solutions/web-automation", label: "Web" },
          { href: "/solutions/mobile-testing", label: "Mobile" },
          { href: "/solutions/api-testing", label: "API" },
          { href: "/solutions/salesforce-testing", label: "Salesforce" },
          { href: "/solutions/erp-sap-testing", label: "SAP" },
          { href: "/platform/impact-analysis", label: "Impact Analysis" },
        ],
      },
      {
        title: "How you test",
        links: [
          { href: "/dashboard/plans/suites", label: "Test Management" },
          { href: "/platform/ai-based-self-healing", label: "Self-Healing" },
          { href: "/platform/root-cause-analysis", label: "Root Cause Analysis" },
          { href: "/solutions/visual-regression", label: "Visual Regression" },
          { href: "/solutions/performance-accessibility", label: "Performance" },
          { href: "/platform/continuous-testing", label: "Continuous Testing" },
        ],
      },
      {
        title: "Platform & AI",
        links: [
          { href: "/platform/at-a-glance", label: "At a Glance" },
          { href: "/platform/test-infrastructure", label: "Test Infrastructure" },
          { href: "/platform/mcp", label: "MCP Server", badge: "New" },
          { href: "/platform/code-export", label: "CodiTOS" },
          { href: "/platform/ai-insights-analytics", label: "AI Insights" },
          { href: "/integrations", label: "Integrations 50+" },
          { href: "/platform/code-export", label: "Code Export" },
        ],
      },
    ],
    promo: { kicker: "Platform & AI", title: "Not three tools", body: "One agentic platform for every surface.", cta: "Book a Demo", href: "/contact-us" },
  },
  {
    label: "Solutions",
    href: "/solutions",
    columns: [
      {
        title: "Specialized testing",
        links: [
          { href: "/solutions/database-testing", label: "Database" },
          { href: "/solutions/security-testing", label: "Security" },
          { href: "/solutions/performance-accessibility", label: "Performance & Accessibility" },
          { href: "/solutions/email-testing", label: "Email Testing" },
        ],
      },
      {
        title: "By industry",
        links: [
          { href: "/industries", label: "Verticals" },
          { href: "/solutions/risk-based-testing", label: "Risk-Based" },
          { href: "/solutions/voice-agent-testing", label: "Voice Agent" },
          { href: "/solutions/saas-ai-tools", label: "SaaS AI Tools" },
        ],
      },
    ],
    promo: { kicker: "Solutions", title: "Not sure where to start?", body: "Explore all solutions by risk, industry and platform.", cta: "Explore all solutions", href: "/solutions" },
  },
  {
    label: "Resources",
    href: "/resources",
    columns: [
      {
        title: "Learn & grow",
        links: [
          { href: "/learning", label: "Learning Hub" },
          { href: "/podcast", label: "The Agentic Quality Podcast" },
          { href: "/community", label: "Ambassador Program" },
          { href: "/tutorials", label: "Tutorials" },
          { href: "/academy", label: "Academy & Certifications" },
        ],
      },
      {
        title: "Content library",
        links: [
          { href: "/blog", label: "Blog" },
          { href: "/ebooks", label: "eBooks" },
          { href: "/whitepapers", label: "Whitepapers" },
          { href: "/case-study", label: "Case Studies" },
          { href: "/newsletter", label: "Newsletter" },
        ],
      },
      {
        title: "Events & tools",
        links: [
          { href: "/webinars", label: "Events" },
          { href: "/webinars", label: "Webinars" },
          { href: "/roi-calculator", label: "ROI Calculator" },
          { href: "/comparison", label: "Product Comparison" },
          { href: "/free-tools", label: "Free Tools" },
          { href: "/downloads", label: "Downloads", badge: "New" },
        ],
      },
    ],
    promo: { kicker: "Resources", title: "Become an Autonomous Test Architect", body: "Free courses, quizzes and certification.", cta: "Start learning", href: "/academy" },
  },
  {
    label: "Company",
    href: "/about-us",
    columns: [
      {
        title: "Company",
        links: [
          { href: "/about-us", label: "About Us" },
          { href: "/why-qasyn", label: "Why QASyn" },
          { href: "/careers", label: "Careers", badge: "Hiring" },
          { href: "/channel-partners", label: "Channel Partners" },
          { href: "/partner-program", label: "Become a Partner" },
          { href: "/pilot-program", label: "Pilot Program" },
          { href: "/media-coverage", label: "Media Coverage" },
          { href: "/community", label: "Community" },
          { href: "/faqs", label: "FAQs" },
          { href: "/contact-us", label: "Contact Us" },
        ],
      },
    ],
    promo: { kicker: "Company", title: "Join the autonomous SDLC", body: "12-week enterprise pilot with SLA.", cta: "Apply for pilot", href: "/pilot-program" },
  },
];

function DesktopMenu({ menu, pathname }: { menu: Menu; pathname: string }) {
  const [open, setOpen] = useState(false);
  const active = pathname === menu.href || pathname.startsWith(`${menu.href}/`);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
          active || open ? "bg-brand-50 text-brand-700" : "text-[#3b4a53] hover:bg-brand-50 hover:text-brand-700",
        )}
      >
        {menu.label} ▾
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-[660px] -translate-x-1/2 rounded-lg border border-pw-line bg-white p-6 shadow-xl shadow-black/5">
          <div className="grid grid-cols-[1fr_1fr_1fr_190px] gap-6">
            {menu.columns.map((col) => (
              <div key={col.title}>
                <p className="text-[10.5px] font-semibold tracking-[0.18em] text-pw-muted uppercase">{col.title}</p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link href={l.href} className="group inline-flex items-center gap-1.5 text-sm text-[#3b4a53] transition hover:text-brand-700">
                        <span className="size-1 rounded-full bg-brand-300 transition group-hover:bg-brand-500" aria-hidden="true" />
                        {l.label}
                        {l.badge && <span className="ml-1 rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-brand-700">{l.badge}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="rounded-lg border border-pw-line bg-pw-bg p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-brand-600 uppercase">{menu.promo.kicker}</p>
              <p className="mt-2 text-sm font-semibold text-pw-heading">{menu.promo.title}</p>
              <p className="mt-1 text-xs leading-5 text-pw-muted">{menu.promo.body}</p>
              <Link href={menu.promo.href} className="mt-3 inline-block rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500">
                {menu.promo.cta}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState<string | null>(null);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-pw-line bg-[#FAFAF7]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6 sm:px-8 lg:px-12">
        <Link href="/" aria-label="QASyn home" className="shrink-0">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1.5 xl:flex">
          {MENUS.map((menu) => (
            <DesktopMenu key={menu.label} menu={menu} pathname={pathname} />
          ))}
          <Link
            href="/pricing"
            className={cn("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition", pathname === "/pricing" ? "bg-brand-50 text-brand-700" : "text-[#3b4a53] hover:bg-brand-50 hover:text-brand-700")}
          >
            Pricing
          </Link>
          <Link
            href="/qasyn"
            className={cn(
              "ml-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
              pathname === "/qasyn"
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-brand-200 bg-white text-brand-600 hover:border-brand-400 hover:text-brand-700",
            )}
          >
            <span className="quantum-pulse size-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(15,107,92,0.5)]" aria-hidden="true" />
            ⚡ QASyn Agent
          </Link>
        </nav>

        <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
          <Link href="/dashboard/learning" className="whitespace-nowrap px-3 py-1.5 text-sm font-medium text-[#3b4a53] transition hover:text-brand-700">
            Learning Hub
          </Link>
          <Link href="/login" className="whitespace-nowrap px-3 py-1.5 text-sm font-medium text-[#3b4a53] transition hover:text-brand-700">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
          >
            Start Free Trial →
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-[#1C2A33] xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="max-h-[70vh] overflow-y-auto border-t border-pw-line bg-white px-5 py-3 xl:hidden">
          <Link href="/qasyn" className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
            <span className="quantum-pulse size-1.5 rounded-full bg-brand-500" aria-hidden="true" /> ⚡ QASyn Agent
          </Link>
          {MENUS.map((menu) => (
            <div key={menu.label} className="border-b border-pw-line py-2">
              <button type="button" className="flex w-full items-center justify-between py-2 text-sm font-semibold text-pw-heading" aria-expanded={mobileMenu === menu.label} onClick={() => setMobileMenu(mobileMenu === menu.label ? null : menu.label)}>
                {menu.label} <span>{mobileMenu === menu.label ? "▾" : "▸"}</span>
              </button>
              {mobileMenu === menu.label && (
                <div className="space-y-3 pb-2 pl-2">
                  {menu.columns.map((col) => (
                    <div key={col.title}>
                      <p className="text-[10.5px] font-semibold tracking-[0.18em] text-pw-muted uppercase">{col.title}</p>
                      {col.links.map((l) => (
                        <Link key={l.href + l.label} href={l.href} className="block py-1 text-sm text-[#3b4a53]">
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/pricing" className="block py-2 text-sm font-medium text-pw-heading">Pricing</Link>
          <Link href="/dashboard/overview" className="block py-2 text-sm font-medium text-pw-heading">Open dashboard</Link>
          <Link href="/login" className="mt-2 block py-2 text-sm font-medium text-pw-heading">Sign in</Link>
          <Link href="/signup" className="mt-2 block rounded-full bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white">Start Free Trial →</Link>
        </nav>
      )}
    </header>
  );
}
