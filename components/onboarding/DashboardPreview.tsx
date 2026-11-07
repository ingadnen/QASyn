"use client";

import { usePathname } from "next/navigation";
import { CrawlTerminal } from "@/components/terminal/CrawlTerminal";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { capitalize } from "@/lib/utils";
import { WorkspacePreviewCard } from "./WorkspacePreviewCard";

const JOURNEYS = [
  { name: "Core", value: 88 },
  { name: "Billing", value: 71 },
  { name: "Settings", value: 40 },
];

/** Step 7 right panel: a miniature of the dashboard the user is about to open. */
export function DashboardPreview() {
  const { state } = useOnboarding();
  const name = capitalize(state.organisation.name || "Your");
  const crawl = state.crawl;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400">
        YOUR DASHBOARD, READY
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] tracking-normal text-emerald-300">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
        </span>
      </p>
      <div className="flex overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <div className="hidden w-28 shrink-0 flex-col gap-1.5 bg-[#0d0e17] p-3 sm:flex">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded bg-brand-600 text-[10px] font-bold text-white">{name.charAt(0)}</span>
            <span className="truncate text-[10px] font-medium text-white">{name}</span>
          </div>
          {["Overview", "Pull requests", "Crawl", "Test cases", "Tunnels", "Billing"].map((item, i) => (
            <span key={item} className={i === 0 ? "rounded bg-white/10 px-1.5 py-1 text-[10px] text-white" : "px-1.5 py-1 text-[10px] text-slate-400"}>
              {item}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-3">
          <CrawlTerminal
            targetUrl={crawl?.targetUrl ?? null}
            startedAt={crawl?.startedAt ?? null}
            status={crawl?.status ?? "idle"}
            height="h-24"
            compact
          />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Test cases", value: "0" },
              { label: "Bugs", value: "0" },
              { label: "Saved", value: "$0" },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-wider text-slate-400">{c.label}</p>
                <p className="text-sm font-semibold text-slate-900">{c.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-slate-100 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Journey protection</p>
            <div className="mt-2 space-y-1.5">
              {JOURNEYS.map((j) => (
                <div key={j.name} className="flex items-center gap-2 text-[10px]">
                  <span className="w-12 text-slate-600">{j.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={j.value >= 80 ? "block h-full rounded-full bg-emerald-500" : j.value >= 60 ? "block h-full rounded-full bg-amber-500" : "block h-full rounded-full bg-red-400"}
                      style={{ width: `${j.value}%` }}
                    />
                  </span>
                  <span className="w-7 text-right tabular-nums text-slate-700">{j.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-500">Illustrative preview · your numbers fill in as QASyn tests your app.</p>
    </div>
  );
}

/** Right panel switcher for /onboarding/[step]. */
export function OnboardingAside() {
  const pathname = usePathname();
  return pathname.endsWith("/7") ? <DashboardPreview /> : <WorkspacePreviewCard />;
}
