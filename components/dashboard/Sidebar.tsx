"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/dashboard/ui";
import { OPEN_CHAT_EVENT } from "@/components/sections/FinQAWidget";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

const SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "AUTONOMOUS SDLC",
    items: [
      { href: "/dashboard/overview", label: "Overview", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
      { href: "/dashboard/pull-requests", label: "Pull requests", icon: "M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9v3a3 3 0 0 1-3 3H9" },
      { href: "/dashboard/crawl", label: "Crawl", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" },
      { href: "/dashboard/code-analysis", label: "Code analysis", icon: "M8 6l-6 6 6 6M16 6l6 6-6 6" },
    ],
  },
  {
    title: "PLATFORM",
    items: [
      { href: "/dashboard/requirements", label: "Requirements", icon: "M9 5h10M9 12h10M9 19h10M4 5h.01M4 12h.01M4 19h.01" },
      { href: "/dashboard/test-cases", label: "Test cases", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" },
      { href: "/dashboard/plans/suites", label: "Test suites", icon: "M4 6h16M4 12h16M4 18h16" },
      { href: "/dashboard/plans/test-plans", label: "Test plans", icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" },
      { href: "/dashboard/environments", label: "Environments", icon: "M4 7h16M4 12h16M4 17h16M7 7v10" },
      { href: "/dashboard/uploads", label: "Uploads", icon: "M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" },
      { href: "/dashboard/knowledge-base", label: "Knowledge base", icon: "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5zM6 19h12" },
      { href: "/dashboard/team", label: "Team", icon: "M16 11a4 4 0 1 0-8 0M3 21a9 9 0 0 1 18 0" },
    ],
  },
  {
    title: "WORK",
    items: [
      { href: "/dashboard/tunnels", label: "Tunnels", icon: "M4 17l6-6-6-6M12 19h8", badge: "New" },
      { href: "/dashboard/integrations", label: "Integrations", icon: "M14 3h7v7M10 14L21 3M21 14v7H3V3h7" },
      { href: "/dashboard/billing", label: "Billing", icon: "M3 7h18v10H3zM3 11h18" },
      { href: "/dashboard/mcp", label: "MCP", icon: "M12 2v6m0 8v6M2 12h6m8 0h6M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
    ],
  },
];

const SETTINGS: NavItem[] = [
  { href: "/dashboard/settings/organization", label: "Organization", icon: "" },
  { href: "/dashboard/settings/audits", label: "Audits", icon: "" },
  { href: "/dashboard/settings/analysis", label: "Analysis", icon: "" },
  { href: "/dashboard/settings/bug-reproduction", label: "Bug reproduction", icon: "" },
  { href: "/dashboard/settings/api-tokens", label: "API tokens", icon: "" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export interface SidebarProps {
  orgName: string;
  logoUrl: string | null;
  isDemo: boolean;
  readOnly: boolean;
  trialDaysLeft: number;
  plan: string;
  user: { name: string; email: string; initials: string };
  ownOrgName: string | null;
}

export function DashboardSidebar({ orgName, logoUrl, isDemo, readOnly, trialDaysLeft, plan, user, ownOrgName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/dashboard/settings"));
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  async function call(url: string, json?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ next?: string }>(url, { method: "POST", json });
      setMenuOpen(false);
      router.push(res.next ?? "/login");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const link = (item: NavItem, nested = false) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition",
        nested && "pl-9",
        isActive(item.href) ? "bg-white/10 font-medium text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
      )}
    >
      {item.icon && <Icon d={item.icon} />}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && <span className="rounded-full bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand-200">{item.badge}</span>}
    </Link>
  );

  const nav = (
    <div className="flex h-full flex-col bg-[#0d0e17] text-slate-300">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-8 rounded-lg object-cover" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white">
            {orgName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{orgName}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live{isDemo && <span className="text-amber-300"> · demo</span>}
          </p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/dashboard/test-cases?new=1"
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/40 transition hover:bg-brand-500"
        >
          + New Test Cases
        </Link>
      </div>

      <nav aria-label="Dashboard" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-[0.16em] text-slate-500">{section.title}</p>
            <div className="space-y-0.5">{section.items.map((i) => link(i))}</div>
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition hover:bg-white/5",
              pathname.startsWith("/dashboard/settings") ? "text-white" : "text-slate-400",
            )}
          >
            <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            <span className="flex-1 text-left">Settings</span>
            <span className="text-xs">{settingsOpen ? "▾" : "▸"}</span>
          </button>
          {settingsOpen && <div className="mt-0.5 space-y-0.5">{SETTINGS.map((i) => link(i, true))}</div>}
        </div>
      </nav>

      <div className="space-y-1 border-t border-white/5 px-3 py-3">
        <button type="button" onClick={() => setHelpOpen(true)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-400 hover:bg-white/5 hover:text-slate-100">
          <Icon d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" /> Help &amp; docs
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-400 hover:bg-white/5 hover:text-slate-100"
        >
          <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> Live chat
        </button>
        <Link href="/dashboard/billing" className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-amber-300 hover:text-amber-200">
          <span className="size-1.5 rounded-full bg-amber-400" />
          {plan === "trial" ? `Trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left` : `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan`}
        </Link>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex w-full items-center gap-2.5 rounded-lg bg-white/5 px-2.5 py-2 text-left hover:bg-white/10"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{user.initials}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-white">{user.name}</span>
              <span className="block truncate text-[11px] text-slate-400">{user.email}</span>
            </span>
            <span className="text-xs text-slate-500">⋯</span>
          </button>
          {menuOpen && (
            <div role="menu" className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#161827] py-1 text-[13px] shadow-2xl">
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.14em] text-slate-500">WORKSPACES</p>
              {ownOrgName ? (
                <button
                  role="menuitem"
                  type="button"
                  disabled={busy || !readOnly}
                  onClick={() => call("/api/auth/switch", { target: "own" })}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-slate-200 hover:bg-white/5 disabled:cursor-default"
                >
                  {ownOrgName} {!readOnly && <span className="text-emerald-400">✓</span>}
                </button>
              ) : (
                <button role="menuitem" type="button" disabled={busy} onClick={() => call("/api/auth/switch", { target: "own" })} className="block w-full px-3 py-1.5 text-left text-slate-200 hover:bg-white/5">
                  + Create your organisation
                </button>
              )}
              {!(isDemo && !readOnly) && (
                <button
                  role="menuitem"
                  type="button"
                  disabled={busy || readOnly}
                  onClick={() => call("/api/auth/switch", { target: "demo" })}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-slate-200 hover:bg-white/5 disabled:cursor-default"
                >
                  Acme (demo) {readOnly && <span className="text-emerald-400">✓</span>}
                </button>
              )}
              <div className="my-1 border-t border-white/5" />
              <button role="menuitem" type="button" disabled={busy} onClick={() => call("/api/auth/logout")} className="block w-full px-3 py-1.5 text-left text-red-300 hover:bg-white/5">
                Log out
              </button>
              {error && <p className="px-3 py-1 text-xs text-red-300">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between bg-[#0d0e17] px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold text-white">{orgName}</span>
        <button type="button" onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-slate-300" aria-label="Open navigation">
          <Icon d="M4 7h16M4 12h16M4 17h16" />
        </button>
      </div>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{nav}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-64">{nav}</aside>
        </div>
      )}

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help & docs">
        <div className="space-y-3 text-sm text-slate-600">
          <p>QASyn is a local prototype. Everything below runs on simulated data stored in SQLite.</p>
          <ul className="space-y-2">
            <li><strong className="text-slate-800">Crawl</strong> — maps your app and turns flows into draft test cases.</li>
            <li><strong className="text-slate-800">Pull requests</strong> — simulate a PR to see impact analysis and regressions.</li>
            <li><strong className="text-slate-800">Tunnels</strong> — test localhost through a (simulated) secure tunnel.</li>
            <li><strong className="text-slate-800">MCP</strong> — query your workspace from an AI assistant with an API token.</li>
          </ul>
          <p>
            Questions? Use <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => { setHelpOpen(false); window.dispatchEvent(new Event(OPEN_CHAT_EVENT)); }}>Live chat</button>.
          </p>
        </div>
      </Modal>
    </>
  );
}
