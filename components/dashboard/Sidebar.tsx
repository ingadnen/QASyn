"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/dashboard/ui";
import { OPEN_CHAT_EVENT } from "@/components/sections/FinQAWidget";
import { apiFetch, errorMessage } from "@/lib/api";
import { permissionsFor, type Permission } from "@/lib/rbac";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
  permission?: Permission;
  children?: NavItem[];
}

const NAV: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "AUTONOMOUS SDLC",
    items: [
      { href: "/dashboard/overview", label: "Overview", icon: "grid_view", permission: "overview" },
      { href: "/dashboard/pull-requests", label: "Pull requests", icon: "merge", permission: "pullRequests" },
      { href: "/dashboard/crawl", label: "Crawl", icon: "travel_explore", permission: "crawl" },
      { href: "/dashboard/code-analysis", label: "Code Analysis", icon: "code", permission: "codeAnalysis" },
    ],
  },
  {
    title: "PLATFORM",
    items: [
      { href: "/dashboard/requirements", label: "Requirements", icon: "description", permission: "requirements" },
      { href: "/dashboard/test-cases", label: "Test cases", icon: "fact_check", permission: "testCases" },
      {
        href: "/dashboard/plans",
        label: "Plans",
        icon: "content_paste_go",
        permission: "plans",
        children: [
          { href: "/dashboard/plans/suites", label: "Test Suites", icon: "folder_copy" },
          { href: "/dashboard/plans/test-plans", label: "Test Plans", icon: "event_note" },
        ],
      },
      {
        href: "/dashboard/environments",
        label: "Environment & Data",
        icon: "database",
        permission: "environments",
        children: [
          { href: "/dashboard/environments", label: "Environments", icon: "dns" },
          { href: "/dashboard/environments?tab=profiles", label: "Test Data Profiles", icon: "table_chart" },
          { href: "/dashboard/environments?tab=global", label: "Global Data", icon: "public" },
          { href: "/dashboard/environments?tab=auth", label: "Auth Profiles", icon: "key" },
        ],
      },
      { href: "/dashboard/uploads", label: "Uploads", icon: "cloud_upload", permission: "uploads" },
      { href: "/dashboard/knowledge-base", label: "Knowledge Base", icon: "article", permission: "knowledgeBase" },
      { href: "/dashboard/team", label: "Team & access", icon: "group", permission: "team" },
    ],
  },
  {
    title: "WORK",
    items: [
      { href: "/dashboard/tunnels", label: "Tunnels", icon: "lan", permission: "tunnels" },
      { href: "/dashboard/integrations", label: "Integrations", icon: "webhook", permission: "integrations" },
      { href: "/dashboard/billing", label: "Billing & usage", icon: "credit_card", permission: "billing" },
      { href: "/dashboard/mcp", label: "MCP", icon: "cable", permission: "mcp" },
    ],
  },
];

const SETTINGS: NavItem[] = [
  { href: "/dashboard/settings/organization", label: "Organization Setting", icon: "corporate_fare", permission: "settings" },
  { href: "/dashboard/settings/audits", label: "System Audits", icon: "history", permission: "audits" },
  { href: "/dashboard/settings/analysis", label: "Analysis Settings", icon: "analytics", permission: "settings" },
  { href: "/dashboard/settings/bug-reproduction", label: "Bug Reproduction", icon: "bug_report", permission: "settings" },
  { href: "/dashboard/settings/api-tokens", label: "API Tokens", icon: "vpn_key", permission: "apiTokens" },
];

function SymbolIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("material-symbols-outlined select-none", className)}>
      {name}
    </span>
  );
}

export interface SidebarProps {
  orgName: string;
  logoUrl: string | null;
  isDemo: boolean;
  readOnly: boolean;
  trialDaysLeft: number;
  plan: string;
  role: string;
  user: { name: string; email: string; initials: string };
  ownOrgName: string | null;
}

export function DashboardSidebar({ orgName, logoUrl, isDemo, readOnly, trialDaysLeft, plan, role, user, ownOrgName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = permissionsFor(role);
  const navSections = NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || allowed.has(item.permission)),
  })).filter((section) => section.items.length > 0);
  const settings = SETTINGS.filter((item) => !item.permission || allowed.has(item.permission));
  const canCreateTestCase = allowed.has("testCasesEdit");
  const [expanded, setExpanded] = useState(false);
  const [plansOpen, setPlansOpen] = useState(pathname.startsWith("/dashboard/plans"));
  const [envOpen, setEnvOpen] = useState(pathname.startsWith("/dashboard/environments"));
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

  const active = (href: string) => {
    const base = href.split("?")[0];
    if (base === "/dashboard/environments") return pathname === base;
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const item = (nav: NavItem, depth = 0) => {
    if (nav.children) {
      const open = nav.href === "/dashboard/plans" ? plansOpen : envOpen;
      const toggle = () => (nav.href === "/dashboard/plans" ? setPlansOpen((v) => !v) : setEnvOpen((v) => !v));
      const parentActive = nav.children.some((c) => active(c.href.split("?")[0])) || active(nav.href);
      return (
        <div key={nav.href}>
          <button
            type="button"
            title={expanded ? undefined : nav.label}
            aria-label={nav.label}
            aria-expanded={open}
            onClick={() => {
              toggle();
              if (!expanded) setExpanded(true);
            }}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg py-1.5 text-[13px] transition",
              expanded ? "px-3" : "justify-center px-0",
              parentActive ? "bg-[#5b4ee8]/15 text-white" : "text-[#98a2b3] hover:bg-white/5 hover:text-white",
            )}
          >
            <SymbolIcon name={nav.icon} className={cn("text-[22px]", parentActive && "text-[#8b80ff]")} />
            {expanded && (
              <>
                <span className="flex-1 text-left">{nav.label}</span>
                <SymbolIcon name={open ? "expand_less" : "expand_more"} className="text-[18px]" />
              </>
            )}
          </button>
          {expanded && open && (
            <div className="mt-0.5 space-y-0.5 pl-3">
              {nav.children.map((c) => (
                <Link
                  key={c.href + c.label}
                  href={c.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md py-1.5 pl-8 pr-3 text-[12.5px] transition",
                    active(c.href.split("?")[0]) && pathname === c.href.split("?")[0]
                      ? "bg-[#5b4ee8]/15 text-white"
                      : "text-[#98a2b3] hover:bg-white/5 hover:text-white",
                  )}
                >
                  <span className="truncate">{c.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <Link
        key={nav.href}
        href={nav.href}
        title={expanded ? undefined : nav.label}
        aria-label={nav.label}
        aria-current={active(nav.href) ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-lg py-1.5 text-[13px] transition",
          expanded ? "px-3" : "justify-center px-0",
          active(nav.href) ? "bg-[#5b4ee8]/15 text-white" : "text-[#98a2b3] hover:bg-white/5 hover:text-white",
        )}
      >
        <SymbolIcon name={nav.icon} className={cn("text-[22px]", active(nav.href) && "text-[#8b80ff]")} />
        {expanded && (
          <>
            <span className="flex-1 truncate">{nav.label}</span>
            {nav.badge && <span className="rounded-full bg-[#5b4ee8] px-1.5 text-[10px] font-semibold text-white">{nav.badge}</span>}
          </>
        )}
      </Link>
    );
  };

  const nav = (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0b0f1a] text-[#98a2b3]">
      <div className={cn("flex items-center gap-2.5 pb-2 pt-3.5", expanded ? "px-3" : "justify-center px-0")}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-8 rounded-lg object-cover" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#5b4ee8] text-sm font-bold text-white">
            {orgName.charAt(0).toUpperCase()}
          </span>
        )}
        {expanded && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{orgName}</p>
            <p className="flex items-center gap-1 text-[10.5px] text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Live{isDemo ? <span className="text-amber-300"> Â· demo</span> : null}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#98a2b3] hover:bg-white/5 hover:text-white"
        >
          <SymbolIcon name={expanded ? "menu_open" : "menu"} className="text-[20px]" />
        </button>
      </div>

      {canCreateTestCase && (
      <div className={cn("pb-3 pt-1", expanded ? "px-3" : "px-2")}>
        <Link
          href="/dashboard/test-cases?new=1"
          title="New Test Cases"
          aria-label="New Test Cases"
          className={cn(
            "flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#5b4ee8] text-sm font-semibold text-white transition hover:bg-[#6d61ff]",
            expanded ? "w-full" : "mx-auto w-9",
          )}
        >
          <SymbolIcon name="add" className="text-[20px]" />
          {expanded && <span>New Test Cases</span>}
        </Link>
      </div>
      )}

      <nav aria-label="Dashboard" className={cn("dark-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pb-3", expanded ? "px-2" : "px-2")}>
        {navSections.map((section) => (
          <div key={section.title}>
            {expanded ? (
              <p className="px-3 pb-1 text-[9.5px] font-semibold tracking-[0.14em] text-[#5f6b7d]">{section.title}</p>
            ) : (
              <p className="mx-auto mb-1 h-px w-6 bg-white/10" aria-hidden="true" />
            )}
            <div className="space-y-0.5">{section.items.map((i) => item(i))}</div>
          </div>
        ))}
        {settings.length > 0 && (
        <div>
          {expanded ? (
            <p className="px-3 pb-1 text-[9.5px] font-semibold tracking-[0.14em] text-[#5f6b7d]">SETTINGS</p>
          ) : (
            <p className="mx-auto mb-1 h-px w-6 bg-white/10" aria-hidden="true" />
          )}
          <button
            type="button"
            title={expanded ? undefined : "Settings"}
            aria-label="Settings"
            aria-expanded={settingsOpen}
            onClick={() => {
              setSettingsOpen((v) => !v);
              if (!expanded) setExpanded(true);
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg py-1.5 text-[13px] transition",
              expanded ? "px-3" : "justify-center px-0",
              pathname.startsWith("/dashboard/settings") ? "bg-[#5b4ee8]/15 text-white" : "text-[#98a2b3] hover:bg-white/5 hover:text-white",
            )}
          >
            <SymbolIcon name="settings" className="text-[22px]" />
            {expanded && (
              <>
                <span className="flex-1 text-left">Settings</span>
                <SymbolIcon name={settingsOpen ? "expand_less" : "expand_more"} className="text-[18px]" />
              </>
            )}
          </button>
          {expanded && settingsOpen && (
            <div className="mt-0.5 space-y-0.5 pl-3">
              {settings.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md py-1.5 pl-8 pr-3 text-[12.5px] transition",
                    pathname === s.href ? "bg-[#5b4ee8]/15 text-white" : "text-[#98a2b3] hover:bg-white/5 hover:text-white",
                  )}
                >
                  <span className="truncate">{s.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        )}
      </nav>

      <div className={cn("space-y-0.5 border-t border-white/5 py-2", expanded ? "px-2" : "px-2")}>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          title={expanded ? undefined : "Help & docs"}
          aria-label="Help & docs"
          className={cn("flex w-full items-center gap-3 rounded-lg py-1.5 text-[12.5px] text-[#98a2b3] hover:bg-white/5 hover:text-white", expanded ? "px-3" : "justify-center px-0")}
        >
          <SymbolIcon name="help" className="text-[20px]" />
          {expanded && <span>Help &amp; docs</span>}
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}
          title={expanded ? undefined : "Live chat"}
          aria-label="Live chat"
          className={cn("flex w-full items-center gap-3 rounded-lg py-1.5 text-[12.5px] text-[#98a2b3] hover:bg-white/5 hover:text-white", expanded ? "px-3" : "justify-center px-0")}
        >
          <SymbolIcon name="chat" className="text-[20px]" />
          {expanded && <span>Live chat</span>}
        </button>
        <Link
          href="/dashboard/billing"
          title={plan === "trial" ? `Trial Â· ${trialDaysLeft} days left` : `${plan} plan`}
          className={cn("flex items-center gap-2 rounded-lg py-1.5 text-[11.5px] text-amber-300 hover:bg-white/5", expanded ? "px-3" : "justify-center px-0")}
        >
          <SymbolIcon name="workspace_premium" className="text-[18px]" />
          {expanded && (
            <span className="truncate">
              {plan === "trial" ? `Trial Â· ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left` : `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan`}
            </span>
          )}
        </Link>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={expanded ? undefined : user.name}
            className={cn("flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left hover:bg-white/5", expanded ? "px-2" : "justify-center px-0")}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#3b2f9e] text-[11px] font-semibold text-white">{user.initials}</span>
            {expanded && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-white">{user.name}</span>
                  <span className="block truncate text-[10.5px] text-[#98a2b3]">{user.email}</span>
                </span>
                <SymbolIcon name="unfold_more" className="text-[16px] text-[#98a2b3]" />
              </>
            )}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#161827] py-1 text-[13px] shadow-2xl"
            >
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold tracking-[0.14em] text-slate-500">WORKSPACES</p>
              {ownOrgName ? (
                <button
                  role="menuitem"
                  type="button"
                  disabled={busy || !readOnly}
                  onClick={() => call("/api/auth/switch", { target: "own" })}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-slate-200 hover:bg-white/5 disabled:cursor-default"
                >
                  {ownOrgName} {!readOnly && <span className="text-emerald-400">âœ“</span>}
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
                  Acme (demo) {readOnly && <span className="text-emerald-400">âœ“</span>}
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
      <div className="flex items-center justify-between bg-[#0b0f1a] px-4 py-2.5 lg:hidden">
        <span className="text-sm font-semibold text-white">{orgName}</span>
        <button type="button" onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-slate-300" aria-label="Open navigation">
          <SymbolIcon name="menu" />
        </button>
      </div>
      <aside className={cn("sticky top-0 z-40 hidden h-screen shrink-0 transition-[width] duration-200 lg:block", expanded ? "w-[240px]" : "w-[60px]")}>{nav}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-[240px]">{nav}</aside>
        </div>
      )}

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help & docs">
        <div className="space-y-3 text-sm text-slate-600">
          <p>QASyn mirrors the QASyn autonomous quality workspace on local SQLite data.</p>
          <ul className="space-y-2">
            <li><strong className="text-slate-800">Crawl</strong> â€” maps your app and turns flows into draft test cases.</li>
            <li><strong className="text-slate-800">Pull requests</strong> â€” simulate a PR to see impact analysis and regressions.</li>
            <li><strong className="text-slate-800">Tunnels</strong> â€” test localhost through a (simulated) secure tunnel.</li>
            <li><strong className="text-slate-800">MCP</strong> â€” query your workspace from an AI assistant with an API token.</li>
          </ul>
          <p>
            Questions? Use{" "}
            <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => { setHelpOpen(false); window.dispatchEvent(new Event(OPEN_CHAT_EVENT)); }}>
              Live chat
            </button>
            .
          </p>
        </div>
      </Modal>
    </>
  );
}
