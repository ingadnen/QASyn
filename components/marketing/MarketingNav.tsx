"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { MARKETING_NAV } from "@/lib/marketing";
import { cn } from "@/lib/utils";

export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="QASyn home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="px-3 py-1.5 text-sm font-medium text-ink hover:text-brand-600">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-ink md:hidden"
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
        <nav id="mobile-nav" aria-label="Mobile" className="animate-fade-in border-t border-line bg-white px-5 py-3 md:hidden">
          {MARKETING_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-lg px-2 py-2.5 text-sm font-medium text-ink">
              {item.label}
            </Link>
          ))}
          <Link href="/login" className="mt-2 block rounded-lg px-2 py-2.5 text-sm font-medium text-ink">
            Log in
          </Link>
          <Link
            href="/signup"
            className="mt-2 block rounded-full bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
          >
            Start free
          </Link>
        </nav>
      )}
    </header>
  );
}
