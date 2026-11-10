"use client";

import Link from "next/link";
import { useState } from "react";
import { CqaIcon, ErrorNote, useAction } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export interface OverviewEvent {
  time: string;
  tag: string;
  message: string;
}

export interface OverviewCoverageRow {
  key: string;
  name: string;
  badge: string;
  percent: number;
  detail: string;
}

export interface OverviewRecent {
  id: string;
  title: string;
  steps: number;
  status: string;
  age: string;
  href: string;
}

export interface OverviewProps {
  readOnly: boolean;
  ownerEmail: string;
  terminal: { events: OverviewEvent[]; running: boolean };
  stats: {
    total: number;
    passing: number;
    failing: number;
    bugs: number;
    reproduced: number;
    saved: number;
    regressions: number;
  };
  strip: { prsChecked: number; integrations: string[] };
  modules: OverviewCoverageRow[];
  criticality: OverviewCoverageRow[];
  recents: OverviewRecent[];
  showSlack: boolean;
  showBugTracker: boolean;
  showInvite: boolean;
}

function SlackLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 122.8 122.8" aria-hidden="true" className={className} focusable="false">
      <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z" fill="#E01E5A" />
      <path d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#E01E5A" />
      <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z" fill="#36C5F0" />
      <path d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36C5F0" />
      <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z" fill="#2EB67D" />
      <path d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2EB67D" />
      <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z" fill="#ECB22E" />
      <path d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ECB22E" />
    </svg>
  );
}

const cardClass = "rounded-[12px] border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]";
const setupCtaClass =
  "inline-flex items-center justify-center rounded-[6px] border border-[#cbd5e1] bg-transparent px-4 py-[6px] text-[11px] font-medium leading-4 text-[#475569] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50";
const setupDismissClass =
  "rounded text-[11px] font-medium text-[#94a3b8] transition hover:text-[#475569] disabled:cursor-not-allowed disabled:opacity-50";

function Terminal({ events, running }: OverviewProps["terminal"]) {
  const [open, setOpen] = useState(false);
  return (
    <section
      aria-label="AQE Terminal activity log"
      className="overflow-hidden rounded-[12px] bg-[#10141c] shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-[10px] px-[15px] py-[11px] text-left"
      >
        <span
          title="A live feed of what the autonomous quality engineer is doing right now: reading commits, mapping journeys, checking pull requests. Click the bar to expand the full history."
          className="flex size-[15px] shrink-0 items-center justify-center rounded-full border border-white/[0.22] text-[9px] font-extrabold leading-none text-[#8a94a6]"
        >
          i
        </span>
        <span className={cn("size-[7px] shrink-0 rounded-full", running ? "animate-pulse bg-[#22c55e]" : "bg-[#22c55e]")} />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] tabular-nums text-[#cbd5e1]">
          Live · {events.length} {events.length === 1 ? "event" : "events"}
        </span>
        <span className="shrink-0 text-[10px] text-white/40">{open ? "collapse" : "expand history"}</span>
        <CqaIcon name={open ? "expand_less" : "expand_more"} className="shrink-0 text-[14px] text-white/40" />
      </button>
      {open && (
        <div
          role="log"
          tabIndex={0}
          aria-live="polite"
          aria-label="AQE Terminal activity log"
          className="max-h-[160px] overflow-y-auto border-t border-white/[0.06] px-[15px] pb-[10px] pt-2"
        >
          {events.length === 0 ? (
            <p className="py-2 font-mono text-[11px] text-[#475569]">Waiting for the autonomous quality engineer…</p>
          ) : (
            events.map((event, index) => (
              <div key={`${event.time}-${event.tag}-${index}`} className="flex gap-[9px] py-[3px] font-mono text-[11px] leading-4">
                <span className="shrink-0 whitespace-nowrap text-[#475569]">{event.time}</span>
                <span className="shrink-0 whitespace-nowrap font-semibold text-[#cbd5e1]">{event.tag}</span>
                <span className="min-w-0 break-words text-[#cbd5e1]">{event.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  suffix,
  footer,
  info,
}: {
  label: string;
  value: string;
  suffix?: string;
  footer?: React.ReactNode;
  info?: string;
}) {
  return (
    <article className="flex h-full min-w-0 flex-col gap-3 rounded-[12px] border border-[#e5e7eb] bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex h-4 items-center gap-[7px]">
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#64748b]">{label}</span>
        {info && (
          <span
            title={info}
            aria-label={info}
            className="flex size-[15px] shrink-0 cursor-help items-center justify-center rounded-full border border-[#d1d5db] text-[9px] font-extrabold text-[#9ca3af]"
          >
            i
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-baseline gap-[6px]">
        <span className="min-w-0 truncate text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#101828]">{value}</span>
        {suffix && <span className="shrink-0 text-[11px] font-medium text-[#737373]">{suffix}</span>}
      </div>
      {footer && <div className="text-[11.5px] font-medium text-[#737373]">{footer}</div>}
    </article>
  );
}

function CoverageCard({
  title,
  countLabel,
  description,
  modules,
  criticality,
}: {
  title: string;
  countLabel: (tab: "module" | "criticality") => string;
  description: string;
  modules: OverviewCoverageRow[];
  criticality: OverviewCoverageRow[];
}) {
  const [tab, setTab] = useState<"module" | "criticality">("module");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const rows = tab === "module" ? modules : criticality;
  const visible = tab === "module" && !showAll ? rows.slice(0, 5) : rows;

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className={cn(cardClass, "px-[17px] py-[15px]")}>
      <div className="flex flex-wrap items-center gap-[10px]">
        <span className="min-w-0 truncate text-[13px] font-bold text-[#0f172a]">{title}</span>
        <div role="tablist" className="inline-flex h-[31.5px] min-w-0 items-start overflow-x-auto rounded-[8px] bg-[#f1f5f9] p-[3.5px]">
          {(["module", "criticality"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value);
                setExpanded(new Set());
                setShowAll(false);
              }}
              className={cn(
                "relative z-0 flex h-[25px] flex-none items-center justify-center whitespace-nowrap rounded-[8px] px-[14px] py-[3.5px] text-center text-[12px] leading-3 transition",
                tab === value ? "bg-[#5b4ee8] font-medium text-white" : "font-normal text-[#64748b] hover:text-[#0f172a]",
              )}
            >
              By {value}
            </button>
          ))}
        </div>
        <span className="text-[10.5px] font-semibold text-[#94a3b8]">{countLabel(tab)}</span>
        <span className="flex-1" />
        {tab === "module" && rows.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="shrink-0 text-[10.5px] font-semibold text-[#5b4ee8] transition hover:text-[#4338ca]"
          >
            {showAll ? "View less" : "View all"}
          </button>
        )}
      </div>
      <p className="mt-[6px] text-[11px] leading-4 text-[#64748b]">{description}</p>

      <div className="mt-1">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-[#9ca3af]">No coverage data yet. Complete a crawl or add test cases.</p>
        ) : (
          visible.map((row, index) => {
            const isOpen = expanded.has(row.key);
            return (
              <div
                key={row.key}
                className={cn(
                  "border-b border-[#f1f5f9] py-[9px]",
                  index === visible.length - 1 && "border-b-0 pb-0",
                )}
              >
                <button type="button" onClick={() => toggle(row.key)} className="block w-full px-1 text-left">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-[11.5px] font-semibold text-[#0f172a]">{row.name}</span>
                    <span className="flex shrink-0 items-center whitespace-nowrap rounded-[5px] bg-[#f1f5f9] px-[7px] py-px text-[9.5px] font-semibold leading-[14px] text-[#737373]">
                      {row.badge}
                    </span>
                    <span className="flex-1" />
                    <span className="shrink-0 text-[11.5px] font-bold text-[#0f172a]">{row.percent}%</span>
                    <CqaIcon name={isOpen ? "expand_less" : "expand_more"} className="shrink-0 text-[14px] text-[#9ca3af]" />
                  </div>
                  <div className="mt-[6px] block h-[5px] overflow-hidden rounded-full bg-[#f1f5f9]">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-[#5b4ee8] to-[#6366f1]"
                      style={{ width: `${Math.max(0, Math.min(100, row.percent))}%` }}
                    />
                  </div>
                </button>
                {isOpen && (
                  <div className="mx-1 mt-2 rounded-[9px] border border-[#e5e7eb] bg-[#f8fafc] px-[11px] py-[9px] text-[11px] leading-4 text-[#475569]">
                    {row.detail}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function QuickStrip({ prsChecked, integrations }: OverviewProps["strip"]) {
  return (
    <div className="grid grid-cols-1 gap-[10px] lg:grid-cols-[1.1fr_1.1fr_1.2fr]">
      <div className={cn(cardClass, "min-w-0 px-[15px] py-3")}>
        <p className="text-[11.5px] font-semibold text-[#364153]">PRs checked</p>
        <div className="mt-[5px] flex items-baseline gap-[7px]">
          <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[#0f172a] tabular-nums">{prsChecked}</span>
          <span className="min-w-0 truncate text-[10.5px] text-[#737373]">watched on every push</span>
        </div>
      </div>

      <div className="min-w-0 rounded-[12px] border border-dashed border-[#d6d9e4] px-[15px] py-3">
        <p className="text-[11.5px] font-semibold text-[#737373]">SLA / lead time</p>
        <div className="mt-[5px] flex items-baseline gap-[7px]">
          <span className="font-mono text-[13px] font-semibold text-[#9ca3af]">coming soon</span>
        </div>
      </div>

      <div className={cn(cardClass, "min-w-0 px-[15px] py-3")}>
        <div className="flex items-baseline gap-2">
          <p className="text-[11.5px] font-semibold text-[#364153]">Integrations</p>
          <span className="flex-1" />
          {integrations.length > 0 && (
            <span className="text-[10.5px] font-semibold text-[#15803d]">{integrations.length} connected</span>
          )}
        </div>
        <div className="mt-[7px] flex items-center gap-[7px]">
          <div className="flex min-w-0 flex-1 items-center gap-[7px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {integrations.map((name) => (
              <Link
                key={name}
                href="/dashboard/integrations"
                title={name}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-[#e5e7eb] bg-white text-[9px] font-bold uppercase text-[#64748b] transition hover:border-[#cbc6fb] hover:text-[#5b4ee8]"
              >
                {name.slice(0, 3)}
              </Link>
            ))}
          </div>
          <Link
            href="/dashboard/integrations"
            title="Add integration"
            aria-label="Add integration"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-[#d6d9e4] text-[#9ca3af] transition hover:border-[#5b4ee8] hover:text-[#5b4ee8]"
          >
            <CqaIcon name="add" className="text-[14px]" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function SupportCard({ ownerEmail, readOnly }: { ownerEmail: string; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <section>
      <div className="flex flex-wrap items-center gap-3 rounded-[11px] border border-[#e5e7eb] bg-white px-[15px] py-[11px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <SlackLogo className="size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#0f172a]">Join your QASyn support channel</p>
          <p className="text-[11px] leading-4 text-[#64748b]">
            Get a shared Slack channel with the QASyn team. We will send the invite to the organization owner, {ownerEmail}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 pl-7">
          <button
            type="button"
            className={setupCtaClass}
            disabled={readOnly || pending === "slack"}
            onClick={() => void run("slack", "/api/dashboard/dismiss", { json: { card: "slack", slackChannel: true } })}
          >
            {pending === "slack" ? "Creating…" : "Create Slack channel"}
            <span className="sr-only"> — Join your QASyn support channel</span>
          </button>
        </div>
      </div>
      <div className="mt-2">
        <ErrorNote error={error} />
      </div>
    </section>
  );
}

function SetupCard({
  icon,
  title,
  description,
  href,
  cta,
  card,
  readOnly,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  card: "bugTracker" | "invite";
  readOnly: boolean;
}) {
  const { run, pending, error } = useAction();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded-[11px] border border-[#e5e7eb] bg-white px-[15px] py-[11px] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <CqaIcon name={icon} className="shrink-0 text-[16px] text-[#737373]" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#0f172a]">{title}</p>
          <p className="text-[11px] leading-4 text-[#64748b]">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 pl-7">
          <Link href={href} className={setupCtaClass}>
            {cta}
            <span className="sr-only"> — {title}</span>
          </Link>
          <button
            type="button"
            aria-label={`Dismiss — ${title}`}
            className={setupDismissClass}
            disabled={readOnly || pending === "dismiss"}
            onClick={() => void run("dismiss", "/api/dashboard/dismiss", { json: { card } })}
          >
            Dismiss
          </button>
        </div>
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

export function Overview(props: OverviewProps) {
  const { stats, terminal, recents } = props;
  return (
    <div className="space-y-3 pb-2">
      <Terminal events={terminal.events} running={terminal.running} />

      {props.showSlack && <SupportCard ownerEmail={props.ownerEmail} readOnly={props.readOnly} />}

      <section aria-label="Dashboard metrics" className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr))]">
        <StatCard
          label="Test cases"
          value={stats.total.toLocaleString("en-US")}
          footer={
            stats.total > 0 ? (
              <>
                <span>{stats.passing.toLocaleString("en-US")} passing</span>
                {stats.failing > 0 && (
                  <>
                    <span> · </span>
                    <span className="text-[#dc2626]">{stats.failing.toLocaleString("en-US")} failing</span>
                  </>
                )}
              </>
            ) : (
              "Generated by crawls and AI"
            )
          }
        />
        <StatCard
          label="Bugs"
          value={stats.bugs.toLocaleString("en-US")}
          footer={`${stats.reproduced.toLocaleString("en-US")} reproduced`}
        />
        <StatCard
          label="Time & cost saved"
          value={`$${Math.round(stats.saved).toLocaleString("en-US")}`}
          suffix="est."
          footer="bugs · PR checks · regressions"
          info="Estimated at $25 per bug found."
        />
        <StatCard label="Regressions caught" value={stats.regressions.toLocaleString("en-US")} />
      </section>

      <QuickStrip prsChecked={props.strip.prsChecked} integrations={props.strip.integrations} />

      <CoverageCard
        title="Modules mapped & coverage"
        countLabel={(tab) => `${tab === "module" ? props.modules.length : props.criticality.length} ${tab === "module" ? "modules" : "tiers"}`}
        description="Test cases by module. Coverage figures are provisional."
        modules={props.modules}
        criticality={props.criticality}
      />

      <section className={cn(cardClass, "px-[17px] py-[15px]")}>
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 truncate text-[13px] font-bold text-[#0f172a]">Recents</span>
          <span className="flex-1" />
          <Link href="/dashboard/test-cases" className="shrink-0 text-[11px] font-semibold text-[#64748b] transition hover:text-[#111827]">
            View all
          </Link>
        </div>
        <div role="group" aria-label="Recent activity" className="mt-[6px]">
          {recents.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[#9ca3af]">No recent test cases yet.</p>
          ) : (
            recents.map((recent, index) => (
              <Link
                key={recent.id}
                href={recent.href}
                className={cn(
                  "group flex items-start gap-[9px] py-[9px]",
                  index > 0 && "border-t border-[#f1f5f9]",
                )}
              >
                <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#eef0ff] text-[#5b4ee8]">
                  <CqaIcon name="fact_check" className="text-[16px]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="min-w-0 truncate text-[12.5px] text-[#0f172a]">{recent.title}</span>
                    <span className="shrink-0 rounded-full bg-[#eef0ff] px-[7px] py-px text-[9px] font-semibold text-[#5b4ee8]">Test Case</span>
                  </span>
                  <span className="mt-px block truncate text-[11px] text-[#64748b]">
                    baseline · {recent.steps} {recent.steps === 1 ? "step" : "steps"} · {recent.status}
                  </span>
                </span>
                <span className="mt-[2px] shrink-0 text-[10.5px] text-[#94a3b8]">{recent.age}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="mt-[3px] size-[14px] shrink-0 text-[#9ca3af] transition group-hover:text-[#5b4ee8]"
                >
                  <path d="M7 17 17 7" />
                  <path d="M8 7h9v9" />
                </svg>
              </Link>
            ))
          )}
        </div>
      </section>

      {(props.showBugTracker || props.showInvite) && (
        <section aria-label="FINISH SETTING UP">
          <span className="block text-[9px] font-extrabold tracking-[0.1em] text-[#94a3b8]">FINISH SETTING UP</span>
          <div role="list" className="mt-2 flex flex-col gap-[7px]">
            {props.showBugTracker && (
              <div role="listitem">
                <SetupCard
                  icon="view_kanban"
                  title="Connect your bug tracker"
                  description="Jira or Linear. New tickets arrive already reproduced."
                  href="/dashboard/integrations"
                  cta="Connect"
                  card="bugTracker"
                  readOnly={props.readOnly}
                />
              </div>
            )}
            {props.showInvite && (
              <div role="listitem">
                <SetupCard
                  icon="person_add"
                  title="Invite a teammate"
                  description="Show the team the baseline. They land with everything already built."
                  href="/dashboard/team"
                  cta="Invite"
                  card="invite"
                  readOnly={props.readOnly}
                />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
