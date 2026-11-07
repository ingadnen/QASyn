"use client";

import { useEffect, useState } from "react";
import { CrawlTerminal } from "@/components/terminal/CrawlTerminal";
import { FOCUS_OPTIONS, PROVIDER_META } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import type { IntegrationDTO } from "@/lib/types";
import { capitalize, cn, firstName, hostOf, normalizeWebsite } from "@/lib/utils";

function integrationLabel(list: IntegrationDTO[]) {
  const item = list[0];
  if (!item) return null;
  const name = PROVIDER_META[item.provider].name;
  return { text: item.detail ? `${name} · ${item.detail}` : name, indexing: item.status === "INDEXING" };
}

/** Right panel of /onboard/organisation and steps 1–6: live workspace preview + AQE Terminal. */
export function WorkspacePreviewCard() {
  const { state } = useOnboarding();
  const org = state.organisation;
  const orgName = org.name.trim();

  const environmentUrl =
    state.reachMode === "localhost"
      ? state.tunnelEnrolled
        ? `http://localhost:${state.localPort}`
        : null
      : normalizeWebsite(state.environmentUrl);
  const crawlTarget = state.crawl?.targetUrl ?? environmentUrl ?? normalizeWebsite(org.website);

  // Local start time for the preview until the server-side CrawlSession exists.
  const [localStart, setLocalStart] = useState<string | null>(null);
  useEffect(() => {
    setLocalStart(crawlTarget ? new Date().toISOString() : null);
  }, [crawlTarget]);
  const startedAt = state.crawl && state.crawl.targetUrl === crawlTarget ? state.crawl.startedAt : localStart;
  const crawlStatus = state.crawl && state.crawl.targetUrl === crawlTarget ? state.crawl.status : "running";

  const code = integrationLabel(state.integrations.filter((i) => i.provider === "GITHUB" || i.provider === "GITLAB"));
  const tracker = integrationLabel(state.integrations.filter((i) => i.provider === "JIRA" || i.provider === "LINEAR"));
  const focus = FOCUS_OPTIONS.find((f) => f.key === state.focusPriority);
  const owner = firstName(org.ownerName);
  const indexing = Boolean(crawlTarget && crawlStatus === "running") || Boolean(code?.indexing);

  const signIn =
    state.appLoginType === "credentials"
      ? state.appLoginUsername
        ? "Credentials provided"
        : "Waiting for credentials"
      : state.appLoginType === "none"
        ? "No login needed"
        : state.appLoginType === "signup_test_account"
          ? "Test account will be created"
          : "Not signed in yet";

  const environment =
    state.reachMode === "localhost"
      ? state.tunnelEnrolled
        ? `localhost:${state.localPort} · tunnel`
        : "Waiting for a route"
      : hostOf(environmentUrl) ?? hostOf(normalizeWebsite(org.website)) ?? "Not set";

  const cards: Array<{ label: string; value: string; active: boolean; pulse?: boolean; wide?: boolean }> = [
    { label: "FOCUS", value: focus?.label ?? "Not chosen yet", active: Boolean(focus) },
    { label: "ENVIRONMENT", value: environment, active: environment !== "Not set" && environment !== "Waiting for a route" },
    { label: "SIGN-IN", value: signIn, active: state.appLoginType !== null },
    { label: "REPOSITORIES", value: code?.text ?? "Not connected", active: Boolean(code), pulse: code?.indexing },
    {
      label: "EVIDENCE",
      value: crawlTarget ? (crawlStatus === "completed" ? "Product flows mapped" : "Mapping product flows…") : "Waiting",
      active: Boolean(crawlTarget),
      pulse: Boolean(crawlTarget) && crawlStatus === "running",
    },
    { label: "ISSUE TRACKER", value: tracker?.text ?? "Not connected", active: Boolean(tracker) },
    {
      label: "TEAM",
      value:
        state.invitedEmails.length > 0
          ? `You + ${state.invitedEmails.length} teammate${state.invitedEmails.length > 1 ? "s" : ""}`
          : `Just you${owner ? ` · ${owner}` : ""}`,
      active: true,
      wide: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="size-10 rounded-xl object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-base font-semibold text-white">
              {(orgName.charAt(0) || "?").toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-slate-900">
              {orgName ? `${capitalize(orgName)} workspace` : "Your workspace"}
            </h2>
            <p className="truncate font-mono text-[11px] text-slate-400">{org.slug || "your-organisation"}.qasyn.local</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              indexing ? "bg-amber-50 text-amber-700 ring-amber-600/20" : "bg-slate-100 text-slate-600 ring-slate-500/10",
            )}
          >
            {indexing && <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />}
            {indexing ? "indexing" : "draft"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {cards.map((card) => (
            <div
              key={card.label}
              className={cn(
                "rounded-lg border px-3 py-2.5 transition",
                card.wide && "col-span-2",
                card.active ? "border-brand-100 bg-brand-50/50" : "border-slate-100 bg-slate-50",
              )}
            >
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-400">{card.label}</p>
              <p className={cn("mt-0.5 flex items-center gap-1.5 truncate text-[13px]", card.active ? "font-medium text-slate-800" : "text-slate-400")}>
                {card.pulse && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />}
                <span className="truncate">{card.value}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <CrawlTerminal targetUrl={crawlTarget} startedAt={startedAt} status={crawlStatus} height="h-44" compact />
    </div>
  );
}
