import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/ship", label: "Ship — AI QA engineer" },
      { href: "/ship#pricing", label: "Pricing" },
      { href: "/integrations", label: "Integrations" },
      { href: "/dashboard/overview", label: "Live dashboard" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/onboard/organisation", label: "Create organisation" },
      { href: "/onboarding/2", label: "Localhost tunnel" },
      { href: "/onboarding/3", label: "Connect code" },
    ],
  },
  {
    title: "Prototype",
    links: [
      { href: "/api/onboarding/context", label: "Workspace API" },
      { href: "/dashboard/overview#terminal", label: "AQE Terminal" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="bg-navy-950 text-slate-400">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo inverted />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Autonomous quality engineering for web apps, APIs and AI agents. Local prototype — all data is simulated.
          </p>
          <form className="mt-6 flex max-w-xs gap-2" action="/onboard/organisation">
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
