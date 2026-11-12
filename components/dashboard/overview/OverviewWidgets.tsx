"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CrawlTerminal } from "@/components/terminal/CrawlTerminal";
import { Button } from "@/components/ui/Button";
import type { ModuleCoverage } from "@/lib/dashboard";
import type { CrawlLogLine, CrawlStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorNote, useAction } from "../ui";

/** Collapsible AQE Terminal of the Overview (live crawl, or replay of the latest run). */
export function OverviewTerminal({
  crawl,
  runLines,
  runLabel,
}: {
  crawl: { id: string; targetUrl: string; status: CrawlStatus; startedAt: string; logs: CrawlLogLine[] } | null;
  runLines: CrawlLogLine[];
  runLabel: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const live = crawl?.status === "running";
  const startedMin = crawl ? Math.max(1, Math.round((Date.now() - new Date(crawl.startedAt).getTime()) / 60000)) : 0;
  const host = crawl ? crawl.targetUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";

  useEffect(() => {
    const msg = sessionStorage.getItem("qasyn_crawl_notice");
    if (msg) {
      setNotice(msg);
      sessionStorage.removeItem("qasyn_crawl_notice");
    }
  }, []);

  return (
    <>
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          ✓ {notice}
          <button type="button" className="ml-auto text-emerald-500" onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
    <section id="terminal" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-emerald-500" : "bg-slate-300")} />
          <span className="font-semibold text-slate-900">AQE Terminal</span>
          <span suppressHydrationWarning className="truncate text-slate-500">
            {live ? `Crawling ${host} · running ${startedMin} min` : runLabel ? `Replay · ${runLabel}` : crawl ? `Last crawl · ${host}` : "Idle"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!open && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              Watch live
            </Button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Collapse terminal" : "Expand terminal"}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            {open ? "^" : "⌄"}
          </button>
        </div>
      </header>
      {open && (
        <div className="px-3 pb-3">
          {live || !runLines.length ? (
            <CrawlTerminal
              targetUrl={crawl?.targetUrl ?? null}
              startedAt={crawl?.startedAt ?? null}
              status={crawl?.status ?? "idle"}
              logs={crawl && !live ? crawl.logs : undefined}
              height="h-56"
            />
          ) : (
            <CrawlTerminal targetUrl="qasyn watch --all" startedAt={null} status="completed" logs={runLines} height="h-56" />
          )}
        </div>
      )}
    </section>
    </>
  );
}

export function SlackBanner({ orgName, readOnly }: { orgName: string; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <div className="rounded-xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-10 items-center justify-center rounded-lg bg-fuchsia-700 text-sm font-bold text-white">S</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Join your {orgName} support channel</p>
          <p className="text-xs text-slate-500">A shared Slack channel with the QASyn team: questions, run alerts and onboarding help.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={readOnly} loading={pending === "create"} onClick={() => run("create", "/api/dashboard/dismiss", { json: { card: "slack", slackChannel: true } })}>
            Create Slack channel
          </Button>
          <Button size="sm" variant="ghost" disabled={readOnly} loading={pending === "dismiss"} onClick={() => run("dismiss", "/api/dashboard/dismiss", { json: { card: "slack" } })}>
            Dismiss
          </Button>
        </div>
      </div>
      <div className="mt-2">
        <ErrorNote error={error} />
      </div>
    </div>
  );
}

export function CrawlBanner({ crawlId, host, pages, flows, readOnly }: { crawlId: string; host: string; pages: number; flows: number; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <div className="rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="relative flex size-10 items-center justify-center rounded-lg bg-brand-600 text-white">
          <span className="absolute inset-0 animate-ping rounded-lg bg-brand-400/40" />
          <svg viewBox="0 0 24 24" className="relative size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">We&apos;re crawling your app</p>
          <p className="text-xs text-slate-500">
            {host} · {pages} pages visited · {flows} flows mapped. Test cases and modules appear when the crawl completes.
          </p>
        </div>
        <Button
          size="sm"
          disabled={readOnly}
          loading={pending === "complete"}
          loadingText="Generating tests…"
          onClick={() => run("complete", `/api/dashboard/crawl/${crawlId}`, { method: "PATCH", json: { action: "complete" } })}
        >
          Complete Crawl Now
        </Button>
      </div>
      <div className="mt-2">
        <ErrorNote error={error} />
      </div>
    </div>
  );
}

export function CoverageTabs({ modules, criticality }: { modules: ModuleCoverage[]; criticality: ModuleCoverage[] }) {
  const [tab, setTab] = useState<"module" | "criticality">("module");
  const rows = tab === "module" ? modules : criticality;
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Modules mapped &amp; coverage</h2>
        <div role="tablist" className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {(["module", "criticality"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("rounded-md px-3 py-1 font-medium", tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
            >
              By {t}
            </button>
          ))}
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          No modules mapped yet. Complete a crawl or{" "}
          <Link href="/dashboard/test-cases?new=1" className="font-medium text-brand-600 hover:underline">
            add test cases
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((m) => (
            <li key={m.name} className="flex items-center gap-4 px-5 py-3">
              <span className="w-28 truncate text-sm font-medium capitalize text-slate-800">{m.name}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className={cn("block h-full rounded-full", m.coverage >= 80 ? "bg-emerald-500" : m.coverage >= 60 ? "bg-amber-500" : "bg-red-400")}
                  style={{ width: `${m.coverage}%` }}
                />
              </span>
              <span className="w-12 text-right text-sm tabular-nums font-semibold text-slate-900">{m.coverage}%</span>
              <span className="hidden w-40 text-right text-xs text-slate-500 sm:block">
                {m.passing}/{m.total} passing{m.failing ? ` · ${m.failing} failing` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FinishCard({
  card,
  title,
  description,
  href,
  cta,
  readOnly,
}: {
  card: "bugTracker" | "invite";
  title: string;
  description: string;
  href: string;
  cta: string;
  readOnly: boolean;
}) {
  const { run, pending, error } = useAction();
  return (
    <div className="flex flex-col rounded-xl border border-dashed border-slate-300 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 flex-1 text-xs text-slate-500">{description}</p>
      <div className="mt-3 flex items-center gap-2">
        <Link href={href} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500">
          {cta}
        </Link>
        <Button size="sm" variant="ghost" disabled={readOnly} loading={pending === "d"} onClick={() => run("d", "/api/dashboard/dismiss", { json: { card } })}>
          Dismiss
        </Button>
      </div>
      <ErrorNote error={error} />
    </div>
  );
}
