"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard/overview", label: "Overview", d: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/dashboard/overview#runs", label: "Test runs", d: "M5 4h14M5 9h14M5 14h9M5 19h6" },
  { href: "/dashboard/overview#terminal", label: "AQE Terminal", d: "M4 6l6 6-6 6M12 18h8" },
  { href: "/onboarding/3", label: "Integrations", d: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" },
  { href: "/onboarding/1", label: "Workspace setup", d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-navy-950 px-4 py-6 lg:flex">
      <Link href="/dashboard/overview" className="px-2">
        <Logo inverted />
      </Link>
      <nav className="mt-10 flex-1 space-y-1">
        {NAV.map((item) => {
          const active = item.href === pathname;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-brand-600/25 text-white ring-1 ring-brand-400/30" : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d={item.d} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/"
        className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
      >
        <span aria-hidden="true">←</span> Back to website
      </Link>
      <div className="rounded-[10px] bg-white/5 p-4 ring-1 ring-white/10">
        <p className="font-serif text-base italic text-white">Ship is watching</p>
        <p className="mt-1 text-xs text-slate-400">Every new deploy triggers impact analysis and targeted regressions.</p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
        </span>
      </div>
    </aside>
  );
}
