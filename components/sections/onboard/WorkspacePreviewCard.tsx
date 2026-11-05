"use client";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { FOCUS_OPTIONS, PROVIDER_META, TOTAL_STEPS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import type { IntegrationDTO } from "@/lib/types";
import { capitalize, cn, firstName, hostOf, normalizeWebsite, slugify } from "@/lib/utils";

interface Row {
  label: string;
  value: string;
  muted: boolean;
  badge?: { tone: BadgeTone; text: string; pulse?: boolean };
  icon: React.ReactNode;
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICONS = {
  focus: "M12 3v3m0 12v3m9-9h-3M6 12H3m15.4-6.4-2.1 2.1M7.7 16.3l-2.1 2.1m0-12.8 2.1 2.1m8.6 8.6 2.1 2.1M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  env: "M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z",
  repo: "M6 3v12m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0c0 4-6 3-12 6",
  evidence: "M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
  tracker: "M8 2v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 9 2 2 4-4",
  team: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m20 0v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
};

function integrationRow(list: IntegrationDTO[]): Pick<Row, "value" | "muted" | "badge"> | null {
  const item = list[0];
  if (!item) return null;
  const name = PROVIDER_META[item.provider].name;
  const value = item.detail ? `${name} · ${item.detail}` : name;
  if (item.status === "INDEXING") return { value, muted: false, badge: { tone: "warning", text: "Indexing", pulse: true } };
  if (item.status === "FAILED") return { value, muted: false, badge: { tone: "danger", text: "Failed" } };
  return { value, muted: false, badge: { tone: "success", text: "Connected" } };
}

/** Carte flottante "{Org} workspace" mise à jour en temps réel depuis OnboardingContext. */
export function WorkspacePreviewCard() {
  const { state } = useOnboarding();
  const org = state.organisation;
  const orgName = org.name.trim();
  const slug = org.slug || slugify(orgName);

  const environmentHost =
    state.reachType === "LOCALHOST"
      ? `localhost:${state.localPort}`
      : hostOf(normalizeWebsite(state.environmentUrl || org.website));

  const focus = FOCUS_OPTIONS.find((f) => f.key === state.focus);
  const code = integrationRow(state.integrations.filter((i) => i.provider === "GITHUB" || i.provider === "GITLAB"));
  const tracker = integrationRow(state.integrations.filter((i) => i.provider === "JIRA" || i.provider === "LINEAR"));
  const owner = firstName(org.ownerName);

  const rows: Row[] = [
    {
      label: "Focus",
      value: focus?.label ?? "Choose a priority",
      muted: !focus,
      icon: <Icon d={ICONS.focus} />,
    },
    {
      label: "Environment",
      value: environmentHost ?? "Not set",
      muted: !environmentHost,
      badge: environmentHost ? { tone: "success", text: "✓ Valid" } : undefined,
      icon: <Icon d={ICONS.env} />,
    },
    {
      label: "Repositories",
      ...(code ?? { value: "Not started", muted: true }),
      icon: <Icon d={ICONS.repo} />,
    },
    {
      label: "Evidence",
      value: state.appDescription.trim() ? "App brief ready" : "Waiting",
      muted: !state.appDescription.trim(),
      icon: <Icon d={ICONS.evidence} />,
    },
    {
      label: "Issue tracker",
      ...(tracker ?? { value: "Optional", muted: true }),
      icon: <Icon d={ICONS.tracker} />,
    },
    {
      label: "Team",
      value:
        state.teamInvites.length > 0
          ? `You + ${state.teamInvites.length} teammate${state.teamInvites.length > 1 ? "s" : ""}`
          : `Just you${owner ? ` - ${owner}` : ""}`,
      muted: false,
      icon: <Icon d={ICONS.team} />,
    },
  ];

  const done = rows.filter((r) => !r.muted).length;
  const progress = state.completed ? 100 : Math.round(((state.currentStep - 1) / TOTAL_STEPS) * 100);

  return (
    <div className="animate-float">
      <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.2em] text-brand-300">Live preview</p>
      <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-semibold text-white shadow-md">
            {(orgName.charAt(0) || "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">
              {orgName ? `${capitalize(orgName)} workspace` : "Your workspace"}
            </h2>
            <p className="truncate font-mono text-xs text-slate-400">qasyn.app/{slug || "your-organisation"}</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-[11px] font-medium text-slate-500">
            <span>Setup</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <ul className="mt-5 divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-3 py-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  row.muted ? "bg-slate-50 text-slate-400" : "bg-brand-50 text-brand-600",
                )}
              >
                {row.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{row.label}</p>
                <p className={cn("truncate text-sm", row.muted ? "text-slate-400" : "font-medium text-slate-800")}>
                  {row.value}
                </p>
              </div>
              {row.badge && (
                <Badge tone={row.badge.tone} dot={row.badge.pulse} pulse={row.badge.pulse}>
                  {row.badge.text}
                </Badge>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-3 text-center text-xs text-slate-400">
          {done} of {rows.length} ready · Ship starts working as soon as you launch.
        </p>
      </div>
    </div>
  );
}
