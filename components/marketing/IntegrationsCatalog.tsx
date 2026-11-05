"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { INTEGRATION_CATALOG, INTEGRATION_CATEGORIES, type IntegrationCategory } from "@/lib/integrations-catalog";
import type { IntegrationStatus, Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface CatalogWorkspace {
  /** "session" = organisation du cookie, "demo" = organisation seed, "none" = aucune */
  source: "session" | "demo" | "none";
  orgName: string | null;
  statuses: Partial<Record<Provider, IntegrationStatus>>;
  /** Lien de connexion par étape (dépend de l'avancement de l'onboarding) */
  connectHref: { 3: string; 4: string };
}

const STATUS_STYLE: Record<IntegrationStatus, { label: string; className: string }> = {
  CONNECTED: { label: "Connected", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  INDEXING: { label: "Indexing…", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 ring-red-200" },
};

export function IntegrationsCatalog({ workspace }: { workspace: CatalogWorkspace }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<IntegrationCategory | "All">("All");
  const [connectedOnly, setConnectedOnly] = useState(false);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATION_CATALOG.filter(
      (item) =>
        (category === "All" || item.category === category) &&
        (!q || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(q)) &&
        (!connectedOnly || (item.provider && workspace.statuses[item.provider])),
    );
  }, [query, category, connectedOnly, workspace.statuses]);

  const connectedCount = Object.keys(workspace.statuses).length;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <label htmlFor="integration-search" className="sr-only">
            Search integrations
          </label>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            id="integration-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GitHub, Jira, Slack…"
            maxLength={60}
            className="w-full rounded-full border border-line bg-white py-2.5 pr-4 pl-10 text-sm text-ink shadow-sm placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-100 focus:outline-none"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={connectedOnly}
            onChange={(e) => setConnectedOnly(e.target.checked)}
            className="size-4 rounded accent-brand-600"
          />
          Connected only ({connectedCount})
        </label>
      </div>

      <div role="group" aria-label="Filter by category" className="mt-5 flex flex-wrap gap-2">
        {(["All", ...INTEGRATION_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              category === c ? "bg-ink text-white" : "bg-slate-100 text-muted hover:bg-slate-200 hover:text-ink",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted" aria-live="polite">
        {items.length} integration{items.length === 1 ? "" : "s"}
      </p>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const status = item.provider ? workspace.statuses[item.provider] : undefined;
          return (
            <li key={item.id} className="animate-fade-in flex flex-col rounded-[14px] border border-line bg-white p-5 transition hover:border-brand-200 hover:shadow-md hover:shadow-brand-900/5">
              <div className="flex items-start justify-between gap-3">
                <span className={cn("flex size-11 items-center justify-center rounded-[10px] text-sm font-bold", item.tile)} aria-hidden="true">
                  {item.mono}
                </span>
                {status ? (
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", STATUS_STYLE[status].className)}>
                    {STATUS_STYLE[status].label}
                  </span>
                ) : item.provider ? (
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">Onboarding</span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-muted">Beta</span>
                )}
              </div>
              <h3 className="mt-4 font-semibold text-ink">{item.name}</h3>
              <p className="text-xs text-muted">{item.category}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{item.description}</p>
              {item.provider && item.step ? (
                <Link
                  href={workspace.connectHref[item.step]}
                  className={cn(
                    "mt-4 rounded-full px-4 py-2 text-center text-sm font-semibold transition",
                    status ? "border border-line text-ink hover:border-brand-300" : "bg-brand-600 text-white hover:bg-brand-700",
                  )}
                >
                  {status ? "Manage" : "Connect"}
                </Link>
              ) : (
                <span className="mt-4 rounded-full border border-dashed border-line px-4 py-2 text-center text-sm text-muted">
                  Available via API · coming soon
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {items.length === 0 && (
        <div className="mt-6 rounded-[14px] border border-dashed border-line p-10 text-center text-sm text-muted">
          No integration matches “{query}”.
        </div>
      )}
    </div>
  );
}
