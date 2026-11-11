"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CqaIcon,
  Modal,
  StatusPill,
  cqaBtnPrimary,
  cqaBtnSecondary,
  cqaCard,
  cqaIconBtn,
  cqaInput,
  cqaLabel,
  useAction,
} from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";
import { ColumnFilter, matchesColumnFilters } from "@/components/contextqa/table-ui";

export interface EnvVariableRow {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export interface EnvCard {
  id: string;
  name: string;
  baseUrl: string;
  description: string;
  accent: string;
  isDefault: boolean;
  variablesCount: number;
  profilesCount: number;
  updatedAt: string;
  variables: EnvVariableRow[];
}

export interface DataProfileRow {
  id: string;
  name: string;
  description: string;
  permission: string;
  columns: number;
  rows: number;
  environmentIds: string[];
  createdAt: string;
}

export interface GlobalRow {
  id: string;
  name: string;
  type: string;
  permission: string;
  value: string;
  tags: string[];
  description: string;
}

export interface AuthRow {
  id: string;
  name: string;
  appUrl: string;
  loginUrl: string;
  method: string;
  username: string;
  autoSignIn: boolean;
  lastSignedInAt: string | null;
}

export interface ProxyRow {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  enabled: boolean;
}

export interface ViewportRow {
  id: string;
  name: string;
  width: number;
  height: number;
  category: string;
}

export interface EnvironmentDataProps {
  tab: "environments" | "profiles" | "global" | "auth";
  readOnly: boolean;
  envs: EnvCard[];
  profiles: DataProfileRow[];
  globals: GlobalRow[];
  auths: AuthRow[];
  proxies: ProxyRow[];
  viewports: ViewportRow[];
}

const TABS = [
  { value: "environments", label: "Environments", icon: "dns" },
  { value: "profiles", label: "Test Data Profiles", icon: "table_rows" },
  { value: "global", label: "Global Data", icon: "public" },
  { value: "auth", label: "Auth Profiles", icon: "lock_person" },
] as const;

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function initialsOf(name: string) {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return "EN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
      <input
        type="search"
        aria-label="Search"
        placeholder="Search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
      />
    </div>
  );
}

function EmptyBlock({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[#f3f4f6] text-[#9ca3af]">
        <CqaIcon name={icon} className="text-[26px]" />
      </div>
      <p className="mt-3 text-[15px] font-medium text-[#374151]">{title}</p>
      <p className="mt-1 max-w-md text-[12.5px] text-[#9ca3af]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function EnvironmentData(props: EnvironmentDataProps) {
  const { tab, readOnly, envs, profiles, globals, auths, proxies, viewports } = props;
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [envPageSize, setEnvPageSize] = useState(50);
  const [profilePageSize, setProfilePageSize] = useState(50);
  const [globalPageSize, setGlobalPageSize] = useState(50);
  const [globalColumns, setGlobalColumns] = useState<Record<string, boolean>>({
    Name: true,
    Type: true,
    Permission: true,
    Value: true,
    Tags: true,
    Description: true,
  });
  const [envFilter, setEnvFilter] = useState("All environments");
  const [permFilter, setPermFilter] = useState("All permissions");
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [envColumnFilters, setEnvColumnFilters] = useState<Record<string, string>>({});
  const [profileColumnFilters, setProfileColumnFilters] = useState<Record<string, string>>({});
  const [globalColumnFilters, setGlobalColumnFilters] = useState<Record<string, string>>({});
  const [authColumnFilters, setAuthColumnFilters] = useState<Record<string, string>>({});
  const [envModal, setEnvModal] = useState<{ mode: "create" } | { mode: "edit"; env: EnvCard } | null>(null);
  const [variablesEnv, setVariablesEnv] = useState<EnvCard | null>(null);
  const [profileModal, setProfileModal] = useState(false);
  const [globalModal, setGlobalModal] = useState(false);
  const [authModal, setAuthModal] = useState(false);
  const [proxyModal, setProxyModal] = useState(false);
  const [viewportModal, setViewportModal] = useState(false);
  const [importOpen, setImportOpen] = useState<null | "environments" | "profiles" | "global" | "auth">(null);

  const filteredEnvs = envs
    .filter((e) => !q || `${e.name} ${e.description} ${e.baseUrl}`.toLowerCase().includes(q.toLowerCase()))
    .filter((e) =>
      matchesColumnFilters(envColumnFilters, {
        Name: `${e.name} ${e.baseUrl}`,
        Description: e.description,
        VARS: String(e.variablesCount),
        PROFILES: String(e.profilesCount),
        Updated: fmtDate(e.updatedAt),
      }),
    );
  const filteredProfiles = profiles.filter((p) => {
    if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (envFilter !== "All environments" && !p.environmentIds.includes(envFilter)) return false;
    if (permFilter !== "All permissions" && p.permission !== permFilter) return false;
    if (
      !matchesColumnFilters(profileColumnFilters, {
        Profile: `${p.name} ${p.description}`,
        Permission: p.permission,
        Environments: p.environmentIds.map((id) => envs.find((e) => e.id === id)?.name || id).join(" "),
        "Rows × Columns": `${p.rows} × ${p.columns}`,
        Created: fmtDate(p.createdAt),
      })
    )
      return false;
    return true;
  });
  const filteredGlobals = globals
    .filter((g) => !q || `${g.name} ${g.description} ${g.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .filter((g) =>
      matchesColumnFilters(globalColumnFilters, {
        Name: g.name,
        Type: g.type,
        Permission: g.permission,
        Value: g.value,
        Tags: g.tags.join(" "),
        Description: g.description,
      }),
    );
  const filteredAuths = auths
    .filter((a) => !q || `${a.name} ${a.appUrl} ${a.username}`.toLowerCase().includes(q.toLowerCase()))
    .filter((a) =>
      matchesColumnFilters(authColumnFilters, {
        Profile: a.name,
        "App URL": a.appUrl,
        Method: a.method,
        Username: a.username,
        "Auto sign-in": a.autoSignIn ? "Yes" : "No",
        "Last signed in": a.lastSignedInAt ? fmtDate(a.lastSignedInAt) : "Never",
      }),
    );

  async function deleteKind(kind: string, id: string, label: string) {
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    await run(`del-${id}`, `/api/dashboard/environment-data?kind=${kind}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  }

  async function duplicateEnv(env: EnvCard) {
    await run(`copy-${env.id}`, "/api/dashboard/environment-data", {
      method: "PATCH",
      json: { kind: "environment", id: env.id, action: "duplicate" },
    });
    router.refresh();
  }

  async function makeDefault(env: EnvCard) {
    await run(`default-${env.id}`, "/api/dashboard/environment-data", {
      method: "PATCH",
      json: { kind: "environment", id: env.id, action: "default" },
    });
    router.refresh();
  }

  function exportCurrent() {
    if (tab === "environments") {
      downloadCsv("environments.csv", envs.map((e) => ({ name: e.name, baseUrl: e.baseUrl, description: e.description })));
    } else if (tab === "profiles") {
      downloadCsv("test-data-profiles.csv", profiles.map((p) => ({ name: p.name, permission: p.permission, rows: p.rows, columns: p.columns })));
    } else if (tab === "global") {
      downloadCsv("global-data.csv", globals.map((g) => ({ name: g.name, type: g.type, permission: g.permission, value: g.value })));
    } else {
      downloadCsv("auth-profiles.csv", auths.map((a) => ({ name: a.name, appUrl: a.appUrl, username: a.username, method: a.method })));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-[#111827]">Environment &amp; Data Management</h1>
        <p className="mt-1 max-w-4xl text-[13.5px] leading-5 text-[#6b7280]">
          The complete data layer that powers test execution across every environment, test case, and plan. Three variable types — that&apos;s it.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-5 border-b border-[#e5e7eb]" role="tablist" aria-label="Environment and data sections">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/dashboard/environments?tab=${t.value}`}
            role="tab"
            aria-selected={tab === t.value}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-[13px] transition",
              tab === t.value ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280] hover:text-[#111827]",
            )}
          >
            <CqaIcon name={t.icon} className="text-[17px]" />
            {t.label}
          </Link>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}

      {tab === "environments" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={q} onChange={setQ} />
            <div className="inline-flex overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                className={cn("inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px]", view === "grid" ? "bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "text-[#4b5563] hover:bg-[#f9fafb]")}
              >
                <CqaIcon name="grid_view" className="text-[17px]" /> Grid
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                className={cn("inline-flex h-9 items-center gap-1.5 border-l border-[#e5e7eb] px-3 text-[12.5px]", view === "list" ? "bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "text-[#4b5563] hover:bg-[#f9fafb]")}
              >
                <CqaIcon name="view_list" className="text-[17px]" /> List
              </button>
            </div>
            <button type="button" className={cqaBtnSecondary} onClick={() => setImportOpen("environments")}>
              <CqaIcon name="file_download" className="text-[17px]" /> Import
            </button>
            <button type="button" className={cqaBtnSecondary} onClick={exportCurrent} disabled={envs.length === 0}>
              <CqaIcon name="file_upload" className="text-[17px]" /> Export
            </button>
            <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setEnvModal({ mode: "create" })}>
              <CqaIcon name="add" className="text-[17px]" /> New environment
            </button>
          </div>

          <div className={cqaCard}>
            {filteredEnvs.length === 0 ? (
              <EmptyBlock
                icon="dns"
                title="No environments yet"
                description="Create an environment to scope variables, DB configs, and data profiles."
                action={
                  <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setEnvModal({ mode: "create" })}>
                    <CqaIcon name="add" className="text-[17px]" /> New environment
                  </button>
                }
              />
            ) : view === "grid" ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredEnvs.slice(0, envPageSize).map((env) => (
                  <EnvironmentCard
                    key={env.id}
                    env={env}
                    readOnly={readOnly}
                    onEdit={() => setEnvModal({ mode: "edit", env })}
                    onDuplicate={() => duplicateEnv(env)}
                    onDelete={() => deleteKind("environment", env.id, env.name)}
                    onDefault={() => makeDefault(env)}
                    onVariables={() => setVariablesEnv(env)}
                  />
                ))}
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setEnvModal({ mode: "create" })}
                  className="flex min-h-[186px] flex-col items-center justify-center gap-2 rounded-[11px] border border-dashed border-[#d1d5db] bg-[#fafafa] px-4 py-6 text-[13px] font-medium text-[#6b7280] transition hover:border-[#a9a1f7] hover:bg-[#f5f3ff] hover:text-[#5b4ee8] disabled:opacity-60"
                >
                  <CqaIcon name="add_circle" className="text-[26px]" />
                  New environment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#f0f1f3]">
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Name<ColumnFilter column="Name" value={envColumnFilters.Name ?? ""} onChange={(value) => setEnvColumnFilters((current) => ({ ...current, Name: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Description<ColumnFilter column="Description" value={envColumnFilters.Description ?? ""} onChange={(value) => setEnvColumnFilters((current) => ({ ...current, Description: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">VARS<ColumnFilter column="VARS" value={envColumnFilters.VARS ?? ""} onChange={(value) => setEnvColumnFilters((current) => ({ ...current, VARS: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">DBS<ColumnFilter column="DBS" value={envColumnFilters.DBS ?? ""} onChange={(value) => setEnvColumnFilters((current) => ({ ...current, DBS: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">PROFILES<ColumnFilter column="PROFILES" value={envColumnFilters.PROFILES ?? ""} onChange={(value) => setEnvColumnFilters((current) => ({ ...current, PROFILES: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Updated<ColumnFilter column="Updated" value={envColumnFilters.Updated ?? ""} onChange={(value) => setEnvColumnFilters((current) => ({ ...current, Updated: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnvs.slice(0, envPageSize).map((env) => (
                      <tr key={env.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-7 items-center justify-center rounded-md text-[10.5px] font-bold text-white" style={{ backgroundColor: env.accent }}>{initialsOf(env.name)}</span>
                            <span className="font-medium text-[#1f2937]">{env.name}</span>
                            {env.isDefault && <span className="rounded bg-[#eef2ff] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide text-[#5b4ee8]">DEFAULT</span>}
                          </div>
                        </td>
                        <td className="max-w-[280px] truncate px-4 py-3 text-[12.5px] text-[#6b7280]">{env.description || "-"}</td>
                        <td className="px-4 py-3 text-[12.5px] font-semibold text-[#374151]">{env.variablesCount}</td>
                        <td className="px-4 py-3 text-[12.5px] font-semibold text-[#374151]">0</td>
                        <td className="px-4 py-3 text-[12.5px] font-semibold text-[#374151]">{env.profilesCount}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#6b7280]">{fmtDate(env.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5">
                            <button type="button" className={cqaIconBtn} aria-label="Edit environment" onClick={() => setEnvModal({ mode: "edit", env })}><CqaIcon name="edit" className="text-[18px]" /></button>
                            <button type="button" className={cqaIconBtn} aria-label="Duplicate environment" onClick={() => duplicateEnv(env)}><CqaIcon name="content_copy" className="text-[18px]" /></button>
                            <button type="button" className={cn(cqaIconBtn, "text-[#dc2626] hover:bg-[#fef2f2]")} aria-label="Delete environment" onClick={() => deleteKind("environment", env.id, env.name)}><CqaIcon name="delete" className="text-[18px]" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  aria-label="Rows per page"
                  className="h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]"
                  value={envPageSize}
                  onChange={(event) => setEnvPageSize(Number(event.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <span className="tabular-nums">1–{Math.min(filteredEnvs.length, envPageSize)} of {filteredEnvs.length}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "profiles" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={q} onChange={setQ} />
            <select aria-label="Filter by environment" className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[12.5px] text-[#374151]" value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
              <option>All environments</option>
              {envs.map((env) => <option key={env.id} value={env.id}>{env.name}</option>)}
            </select>
            <select aria-label="Filter by permission" className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[12.5px] text-[#374151]" value={permFilter} onChange={(e) => setPermFilter(e.target.value)}>
              <option>All permissions</option>
              <option>RO</option>
              <option>RW</option>
            </select>
            <button type="button" className={cqaBtnSecondary} onClick={() => setImportOpen("profiles")}>
              <CqaIcon name="file_download" className="text-[17px]" /> Import
            </button>
            <button type="button" className={cqaBtnSecondary} onClick={exportCurrent} disabled={profiles.length === 0}>
              <CqaIcon name="file_upload" className="text-[17px]" /> Export
            </button>
            <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setProfileModal(true)}>
              <CqaIcon name="add" className="text-[17px]" /> New test data profile
            </button>
          </div>

          <div className={cqaCard}>
            {filteredProfiles.length === 0 ? (
              <EmptyBlock
                icon="table_rows"
                title="No test data profiles yet"
                description="Create a profile to scope test data per environment."
                action={
                  <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setProfileModal(true)}>
                    <CqaIcon name="add" className="text-[17px]" /> New test data profile
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#f0f1f3]">
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Profile<ColumnFilter column="Profile" value={profileColumnFilters.Profile ?? ""} onChange={(value) => setProfileColumnFilters((current) => ({ ...current, Profile: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Permission<ColumnFilter column="Permission" value={profileColumnFilters.Permission ?? ""} onChange={(value) => setProfileColumnFilters((current) => ({ ...current, Permission: value }))} options={[...new Set(profiles.map((p) => p.permission))]} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Environments<ColumnFilter column="Environments" value={profileColumnFilters.Environments ?? ""} onChange={(value) => setProfileColumnFilters((current) => ({ ...current, Environments: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Rows × Columns<ColumnFilter column="Rows × Columns" value={profileColumnFilters["Rows × Columns"] ?? ""} onChange={(value) => setProfileColumnFilters((current) => ({ ...current, "Rows × Columns": value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Created<ColumnFilter column="Created" value={profileColumnFilters.Created ?? ""} onChange={(value) => setProfileColumnFilters((current) => ({ ...current, Created: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.slice(0, profilePageSize).map((p) => (
                      <tr key={p.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1f2937]">{p.name}</p>
                          {p.description && <p className="mt-0.5 max-w-[320px] truncate text-[11.5px] text-[#9ca3af]">{p.description}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[11px] font-medium text-[#374151]">
                            <CqaIcon name={p.permission === "RO" ? "lock" : "edit"} className="text-[13px]" /> {p.permission}
                          </span>
                        </td>
                        <td className="max-w-[220px] px-4 py-3 text-[12.5px] text-[#4b5563]">
                          {p.environmentIds.map((id) => envs.find((e) => e.id === id)?.name).filter(Boolean).join(", ") || "All environments"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-[#4b5563]">{p.rows} × {p.columns}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#6b7280]">{fmtDate(p.createdAt)}</td>
                        <td className="px-4 py-3">
                          <button type="button" className={cn(cqaIconBtn, "text-[#dc2626] hover:bg-[#fef2f2]")} aria-label={`Delete ${p.name}`} onClick={() => deleteKind("profile", p.id, p.name)}>
                            <CqaIcon name="delete" className="text-[18px]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
              <span>Rows per page <select
                aria-label="Rows per page"
                className="ml-1 h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]"
                value={profilePageSize}
                onChange={(event) => setProfilePageSize(Number(event.target.value))}
              ><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></span>
              <span className="tabular-nums">1–{Math.min(filteredProfiles.length, profilePageSize)} of {filteredProfiles.length}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "global" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-[11px] border border-[#e0e7ff] bg-[#eef2ff] px-4 py-3 text-[12.5px] leading-5 text-[#4338ca]">
            <CqaIcon name="public" className="mt-0.5 text-[18px]" />
            <p>
              Environment-agnostic. These variables are accessible from every test case regardless of which environment is selected. Names must be unique across the entire workspace. Tag them for quick filtering.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={q} onChange={setQ} />
            <button type="button" className={cqaBtnSecondary} onClick={() => setImportOpen("global")}>
              <CqaIcon name="file_download" className="text-[17px]" /> Import
            </button>
            <button type="button" className={cqaBtnSecondary} onClick={exportCurrent} disabled={globals.length === 0}>
              <CqaIcon name="file_upload" className="text-[17px]" /> Export all
            </button>
            <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setGlobalModal(true)}>
              <CqaIcon name="add" className="text-[17px]" /> New global variable
            </button>
            <button type="button" className={cqaIconBtn} aria-label="Table settings" onClick={() => setShowGlobalSettings((v) => !v)}>
              <CqaIcon name="settings" className="text-[18px]" />
            </button>
            <button type="button" className={cqaIconBtn} aria-label="Refresh" onClick={() => router.refresh()}>
              <CqaIcon name="refresh" className="text-[18px]" />
            </button>
          </div>
          {showGlobalSettings && (
            <div className="ml-auto w-full max-w-[380px] rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Show columns</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] text-[#374151]">
                {["Name", "Type", "Permission", "Value", "Tags", "Description"].map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={globalColumns[c]}
                      onChange={(event) => setGlobalColumns((prev) => ({ ...prev, [c]: event.target.checked }))}
                      className="size-3.5 accent-[#5b4ee8]"
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className={cqaCard}>
            {filteredGlobals.length === 0 ? (
              <EmptyBlock
                icon="public"
                title="No global variables"
                description="Create workspace-wide variables accessible from any test case."
                action={
                  <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setGlobalModal(true)}>
                    <CqaIcon name="add" className="text-[17px]" /> New global variable
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#f0f1f3]">
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Name<ColumnFilter column="Name" value={globalColumnFilters.Name ?? ""} onChange={(value) => setGlobalColumnFilters((current) => ({ ...current, Name: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Type<ColumnFilter column="Type" value={globalColumnFilters.Type ?? ""} onChange={(value) => setGlobalColumnFilters((current) => ({ ...current, Type: value }))} options={[...new Set(globals.map((g) => g.type))]} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Permission<ColumnFilter column="Permission" value={globalColumnFilters.Permission ?? ""} onChange={(value) => setGlobalColumnFilters((current) => ({ ...current, Permission: value }))} options={[...new Set(globals.map((g) => g.permission))]} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Value<ColumnFilter column="Value" value={globalColumnFilters.Value ?? ""} onChange={(value) => setGlobalColumnFilters((current) => ({ ...current, Value: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Tags<ColumnFilter column="Tags" value={globalColumnFilters.Tags ?? ""} onChange={(value) => setGlobalColumnFilters((current) => ({ ...current, Tags: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Description<ColumnFilter column="Description" value={globalColumnFilters.Description ?? ""} onChange={(value) => setGlobalColumnFilters((current) => ({ ...current, Description: value }))} /></th>
                      <th className="w-10 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGlobals.slice(0, globalPageSize).map((g) => (
                      <tr key={g.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                        {globalColumns.Name && <td className="px-4 py-3"><code className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[11.5px] font-medium text-[#374151]">{g.name}</code></td>}
                        {globalColumns.Type && <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{g.type}</td>}
                        {globalColumns.Permission && <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[11px] font-medium text-[#374151]">
                            <CqaIcon name={g.permission === "RO" ? "lock" : "edit"} className="text-[13px]" /> {g.permission}
                          </span>
                        </td>}
                        {globalColumns.Value && <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11.5px] text-[#6b7280]">{g.type === "Secret" ? "••••••••" : g.value || "-"}</td>}
                        {globalColumns.Tags && <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {g.tags.length === 0 ? <span className="text-[12px] text-[#9ca3af]">-</span> : g.tags.map((t) => <span key={t} className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10.5px] font-medium text-[#5b4ee8]">{t}</span>)}
                          </div>
                        </td>}
                        {globalColumns.Description && <td className="max-w-[260px] truncate px-4 py-3 text-[12.5px] text-[#6b7280]">{g.description || "-"}</td>}
                        <td className="px-4 py-3">
                          <button type="button" className={cn(cqaIconBtn, "text-[#dc2626] hover:bg-[#fef2f2]")} aria-label={`Delete ${g.name}`} onClick={() => deleteKind("global", g.id, g.name)}>
                            <CqaIcon name="delete" className="text-[18px]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
              <span>Rows per page <select
                aria-label="Rows per page"
                className="ml-1 h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]"
                value={globalPageSize}
                onChange={(event) => setGlobalPageSize(Number(event.target.value))}
              ><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></span>
              <span className="tabular-nums">1–{Math.min(filteredGlobals.length, globalPageSize)} of {filteredGlobals.length}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "auth" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-3xl text-[13px] leading-5 text-[#6b7280]">
              The app logins Ship holds for your tests and crawls. Each keeps its latest captured session, encrypted, and the login test that can sign in again when it expires.
            </p>
            <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setAuthModal(true)}>
              <CqaIcon name="add" className="text-[17px]" /> Add auth profile
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={q} onChange={setQ} />
            <button type="button" className={cqaBtnSecondary} onClick={() => setImportOpen("auth")}>
              <CqaIcon name="file_download" className="text-[17px]" /> Import
            </button>
            <button type="button" className={cqaBtnSecondary} onClick={exportCurrent} disabled={auths.length === 0}>
              <CqaIcon name="file_upload" className="text-[17px]" /> Export
            </button>
          </div>
          <div className={cqaCard}>
            {filteredAuths.length === 0 ? (
              <EmptyBlock
                icon="lock_person"
                title="No auth profiles yet"
                description="Add a login for Ship to use, or finish onboarding and the login it captured appears here."
                action={
                  <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setAuthModal(true)}>
                    <CqaIcon name="add" className="text-[17px]" /> Add auth profile
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#f0f1f3]">
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Profile<ColumnFilter column="Profile" value={authColumnFilters.Profile ?? ""} onChange={(value) => setAuthColumnFilters((current) => ({ ...current, Profile: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">App URL<ColumnFilter column="App URL" value={authColumnFilters["App URL"] ?? ""} onChange={(value) => setAuthColumnFilters((current) => ({ ...current, "App URL": value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Method<ColumnFilter column="Method" value={authColumnFilters.Method ?? ""} onChange={(value) => setAuthColumnFilters((current) => ({ ...current, Method: value }))} options={[...new Set(auths.map((a) => a.method))]} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Username<ColumnFilter column="Username" value={authColumnFilters.Username ?? ""} onChange={(value) => setAuthColumnFilters((current) => ({ ...current, Username: value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Auto sign-in<ColumnFilter column="Auto sign-in" value={authColumnFilters["Auto sign-in"] ?? ""} onChange={(value) => setAuthColumnFilters((current) => ({ ...current, "Auto sign-in": value }))} options={["Yes", "No"]} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Last signed in<ColumnFilter column="Last signed in" value={authColumnFilters["Last signed in"] ?? ""} onChange={(value) => setAuthColumnFilters((current) => ({ ...current, "Last signed in": value }))} /></th>
                      <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuths.map((a) => (
                      <tr key={a.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1f2937]">{a.name}</p>
                          {a.loginUrl && <p className="mt-0.5 max-w-[220px] truncate text-[11.5px] text-[#9ca3af]">{a.loginUrl}</p>}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-[12.5px] text-[#4b5563]">{a.appUrl}</td>
                        <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{a.method}</td>
                        <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{a.username || "-"}</td>
                        <td className="px-4 py-3">
                          <StatusPill value={a.autoSignIn ? "active" : "off"} label={a.autoSignIn ? "Enabled" : "Disabled"} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#6b7280]">{a.lastSignedInAt ? fmtDate(a.lastSignedInAt) : "Never"}</td>
                        <td className="px-4 py-3">
                          <button type="button" className={cn(cqaIconBtn, "text-[#dc2626] hover:bg-[#fef2f2]")} aria-label={`Delete ${a.name}`} onClick={() => deleteKind("auth", a.id, a.name)}>
                            <CqaIcon name="delete" className="text-[18px]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#111827]">Proxy Profiles</h2>
              <p className="mt-0.5 text-[12.5px] text-[#6b7280]">Proxy connections available to every test plan and test case in this organization. Assign one from a test plan&apos;s or test case&apos;s settings.</p>
            </div>
            <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => setProxyModal(true)}>
              <CqaIcon name="add" className="text-[17px]" /> Add Proxy
            </button>
          </div>
          <div className={cqaCard}>
            {proxies.length === 0 ? (
              <EmptyBlock icon="lan" title="No proxy profiles" description="Add a proxy to route test execution through your internal network." />
            ) : (
              <ul className="divide-y divide-[#f3f4f6]">
                {proxies.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[12.5px]">
                    <span className="font-medium text-[#1f2937]">{p.name}</span>
                    <span className="text-[#6b7280]">{p.host}:{p.port}</span>
                    <StatusPill value={p.enabled ? "active" : "off"} label={p.enabled ? "Enabled" : "Disabled"} />
                    <button type="button" className={cn(cqaIconBtn, "ml-auto text-[#dc2626] hover:bg-[#fef2f2]")} aria-label={`Delete proxy ${p.name}`} onClick={() => deleteKind("proxy", p.id, p.name)}>
                      <CqaIcon name="delete" className="text-[18px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#111827]">Viewport Configurations</h2>
              <p className="mt-0.5 text-[12.5px] text-[#6b7280]">Named viewports available to test plans and execution settings.</p>
            </div>
            <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => setViewportModal(true)}>
              <CqaIcon name="add" className="text-[17px]" /> Add Viewport
            </button>
          </div>
          <div className={cqaCard}>
            {viewports.length === 0 ? (
              <EmptyBlock icon="aspect_ratio" title="No viewport configurations" description="Add a viewport to run tests at a specific screen resolution." />
            ) : (
              <div className="flex flex-wrap gap-2 p-4">
                {viewports.map((v) => (
                  <span key={v.id} className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] text-[#374151]">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">{v.category}</span>
                    {v.name} ({v.width}×{v.height})
                    <button type="button" className="text-[#9ca3af] hover:text-[#dc2626]" aria-label={`Delete viewport ${v.name}`} onClick={() => deleteKind("viewport", v.id, v.name)}>
                      <CqaIcon name="close" className="text-[14px]" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <EnvironmentModal
        open={envModal !== null}
        mode={envModal?.mode ?? "create"}
        env={envModal?.mode === "edit" ? envModal.env : null}
        readOnly={readOnly}
        onClose={() => setEnvModal(null)}
      />
      <VariablesModal open={variablesEnv !== null} env={variablesEnv} readOnly={readOnly} onClose={() => setVariablesEnv(null)} />
      <DataProfileModal open={profileModal} envs={envs} readOnly={readOnly} onClose={() => setProfileModal(false)} />
      <GlobalVariableModal open={globalModal} readOnly={readOnly} onClose={() => setGlobalModal(false)} />
      <AuthProfileModal open={authModal} defaultAppUrl={envs[0]?.baseUrl ?? ""} readOnly={readOnly} onClose={() => setAuthModal(false)} />
      <ProxyModal open={proxyModal} readOnly={readOnly} onClose={() => setProxyModal(false)} />
      <ViewportModal open={viewportModal} readOnly={readOnly} onClose={() => setViewportModal(false)} />
      <ImportModal kind={importOpen} envs={envs} readOnly={readOnly} onClose={() => setImportOpen(null)} />

    </div>
  );
}

function EnvironmentCard({
  env,
  readOnly,
  onEdit,
  onDuplicate,
  onDelete,
  onDefault,
  onVariables,
}: {
  env: EnvCard;
  readOnly: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDefault: () => void;
  onVariables: () => void;
}) {
  return (
    <div className={cn(cqaCard, "flex flex-col gap-3 p-4")}>
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ backgroundColor: env.accent }}>
          {initialsOf(env.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-[13.5px] font-semibold text-[#1f2937]">{env.name}</p>
            {env.isDefault && <span className="rounded bg-[#eef2ff] px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide text-[#5b4ee8]">DEFAULT</span>}
          </div>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">Updated {fmtDate(env.updatedAt)}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" className={cqaIconBtn} aria-label={`Duplicate ${env.name}`} title="Duplicate environment" disabled={readOnly} onClick={onDuplicate}>
            <CqaIcon name="content_copy" className="text-[17px]" />
          </button>
          <button type="button" className={cn(cqaIconBtn, "text-[#dc2626] hover:bg-[#fef2f2]")} aria-label={`Delete ${env.name}`} title="Delete environment" disabled={readOnly} onClick={onDelete}>
            <CqaIcon name="delete" className="text-[17px]" />
          </button>
        </div>
      </div>
      <p className="min-h-[34px] text-[12px] leading-[17px] text-[#6b7280]">{env.description || "No description."}</p>
      <div className="grid grid-cols-3 divide-x divide-[#f0f1f3] rounded-lg bg-[#fafafa] py-2 text-center">
        <div>
          <p className="text-[15px] font-semibold text-[#1f2937]">{env.variablesCount}</p>
          <p className="text-[9.5px] font-medium tracking-[0.08em] text-[#9ca3af]">VARS</p>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#1f2937]">0</p>
          <p className="text-[9.5px] font-medium tracking-[0.08em] text-[#9ca3af]">DBS</p>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#1f2937]">{env.profilesCount}</p>
          <p className="text-[9.5px] font-medium tracking-[0.08em] text-[#9ca3af]">PROFILES</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="inline-flex items-center gap-1 text-[12px] font-medium text-[#5b4ee8] hover:underline" onClick={onEdit} disabled={readOnly}>
          <CqaIcon name="edit" className="text-[15px]" /> Edit
        </button>
        <div className="flex items-center gap-2">
          {!env.isDefault && (
            <button type="button" className="inline-flex items-center gap-1 text-[11.5px] text-[#6b7280] hover:text-[#5b4ee8]" onClick={onDefault} disabled={readOnly} title="Make this the default environment">
              <CqaIcon name="star" className="text-[15px]" /> Set default
            </button>
          )}
          <button type="button" className="inline-flex items-center gap-1 text-[12px] font-medium text-[#5b4ee8] hover:underline" onClick={onVariables} disabled={readOnly}>
            <CqaIcon name="add_circle" className="text-[15px]" /> Variables
          </button>
        </div>
      </div>
    </div>
  );
}

const ACCENTS = ["#5b4ee8", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#475569"];

function EnvironmentModal({
  open,
  mode,
  env,
  readOnly,
  onClose,
  hasOtherDefault,
}: {
  open: boolean;
  mode: "create" | "edit";
  env: EnvCard | null;
  readOnly: boolean;
  onClose: () => void;
  hasOtherDefault?: boolean;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [isDefault, setIsDefault] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(env?.name ?? "");
    setDescription(env?.description ?? "");
    setAccent(env?.accent ?? ACCENTS[0]);
    setIsDefault(env?.isDefault ?? false);
    setError(null);
  }, [open, env, setError]);

  function wrap(before: string, after = before) {
    const el = descriptionRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${description.slice(0, start)}${before}${description.slice(start, end)}${after}${description.slice(end)}`;
    setDescription(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "create") {
      const res = await run("env", "/api/dashboard/environment-data", {
        json: { kind: "environment", name, description, accent, isDefault },
      });
      if (res) {
        router.refresh();
        onClose();
      }
    } else if (env) {
      const res = await run("env", "/api/dashboard/environment-data", {
        method: "PATCH",
        json: { kind: "environment", id: env.id, action: "update", name, description, accent, isDefault },
      });
      if (res) {
        router.refresh();
        onClose();
      }
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "New environment" : "Edit environment"}
      footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" form="environment-form" className={cqaBtnPrimary} disabled={readOnly || pending === "env" || !name.trim()}>
            {pending === "env" ? "Saving…" : mode === "create" ? "Create environment" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="environment-form" onSubmit={submit} className="space-y-4">
        <p className="text-[12.5px] text-[#6b7280]">Create an environment to scope variables, DB configs, and data profiles.</p>
        <label className="block">
          <span className={cqaLabel}>Environment name *</span>
          <input className={cqaInput} value={name} maxLength={50} required onChange={(e) => setName(e.target.value)} placeholder="e.g. Staging" />
          <span className="mt-1 flex items-center justify-between text-[11px] text-[#9ca3af]">
            <span>Names are user-defined. Be concise — you&apos;ll see this on every test run.</span>
            <span className="tabular-nums">{name.length}/50</span>
          </span>
        </label>
        <div>
          <span className={cqaLabel}>Description</span>
          <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-[#e5e7eb] bg-[#fafafa] px-1.5 py-1 text-[#6b7280]">
            {[
              { icon: "format_bold", label: "Bold", act: () => wrap("**") },
              { icon: "format_italic", label: "Italic", act: () => wrap("_") },
              { icon: "strikethrough_s", label: "Strikethrough", act: () => wrap("~~") },
              { icon: "link", label: "Link", act: () => wrap("[", "](url)") },
              { icon: "format_h1", label: "Heading", act: () => wrap("## ", "") },
              { icon: "format_quote", label: "Quote", act: () => wrap("> ", "") },
              { icon: "code", label: "Code", act: () => wrap("`") },
              { icon: "format_list_bulleted", label: "Bullets", act: () => wrap("- ", "") },
              { icon: "format_list_numbered", label: "Numbers", act: () => wrap("1. ", "") },
            ].map((b) => (
              <button key={b.label} type="button" title={b.label} aria-label={b.label} onClick={b.act} className="rounded p-1 hover:bg-[#e5e7eb]">
                <CqaIcon name={b.icon} className="text-[16px]" />
              </button>
            ))}
          </div>
          <textarea
            ref={descriptionRef}
            className="min-h-[86px] w-full rounded-b-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this environment for?"
          />
        </div>
        <div>
          <span className={cqaLabel}>Accent color</span>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Accent ${c}`}
                aria-pressed={accent === c}
                onClick={() => setAccent(c)}
                className={cn("size-7 rounded-full border-2 transition", accent === c ? "border-[#111827] ring-2 ring-[#e4e1fd]" : "border-transparent")}
                style={{ backgroundColor: c }}
              />
            ))}
            <label className="ml-1 inline-flex items-center gap-1.5 text-[11.5px] text-[#6b7280]">
              Custom
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-[#e5e7eb] bg-white p-0.5" />
            </label>
          </div>
        </div>
        <div className="rounded-lg border border-[#f0f1f3] bg-[#fafafa] px-3 py-2.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12.5px] font-medium text-[#111827]">Make this the default environment</p>
              {hasOtherDefault && !isDefault && (
                <p className="mt-0.5 text-[11.5px] text-[#9ca3af]">Another environment is currently the default. Toggling this on will demote it.</p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDefault}
              aria-label="Make this the default environment"
              onClick={() => setIsDefault((v) => !v)}
              className={cn("relative h-[22px] w-[40px] shrink-0 rounded-full transition", isDefault ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
            >
              <span className={cn("absolute top-[3px] size-4 rounded-full bg-white shadow transition", isDefault ? "left-[21px]" : "left-[3px]")} />
            </button>
          </div>
        </div>
        {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

function VariablesModal({
  open,
  env,
  readOnly,
  onClose,
}: {
  open: boolean;
  env: EnvCard | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [list, setList] = useState<EnvVariableRow[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isSecret, setIsSecret] = useState(false);

  useEffect(() => {
    if (open) {
      setList(env?.variables ?? []);
      setKey("");
      setValue("");
      setIsSecret(false);
      setError(null);
    }
  }, [open, env, setError]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!env) return;
    const res = await run("var", "/api/dashboard/env-variables", { json: { environmentId: env.id, key, value, isSecret } });
    if (res) {
      setList((prev) => [...prev.filter((v) => v.key !== key), { id: `local-${key}`, key, value: isSecret ? "••••••••" : value, isSecret }]);
      setKey("");
      setValue("");
      setIsSecret(false);
      router.refresh();
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete variable "${name}"?`)) return;
    if (!id.startsWith("local-")) {
      await run(`del-var-${id}`, `/api/dashboard/env-variables?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    }
    setList((prev) => prev.filter((v) => v.id !== id));
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Environment variables${env ? ` · ${env.name}` : ""}`}
      footer={<button type="button" className={cqaBtnSecondary} onClick={onClose}>Close</button>}
    >
      <div className="space-y-4">
        <p className="text-[12.5px] text-[#6b7280]">Variables are scoped to this environment and override global data with the same name.</p>
        <div className="overflow-hidden rounded-lg border border-[#e5e7eb]">
          {list.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] text-[#9ca3af]">No variables yet.</p>
          ) : (
            <ul className="divide-y divide-[#f3f4f6]">
              {list.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                  <code className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[11.5px] text-[#374151]">{v.key}</code>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[#6b7280]">{v.isSecret ? "••••••••" : v.value}</span>
                  {v.isSecret && <CqaIcon name="lock" className="text-[15px] text-[#9ca3af]" />}
                  <button type="button" className={cn(cqaIconBtn, "text-[#dc2626] hover:bg-[#fef2f2]")} aria-label={`Delete ${v.key}`} disabled={readOnly} onClick={() => remove(v.id, v.key)}>
                    <CqaIcon name="delete" className="text-[16px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form onSubmit={add} className="space-y-3 rounded-lg border border-[#f0f1f3] bg-[#fafafa] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={cqaLabel}>Key *</span>
              <input className={cqaInput} value={key} onChange={(e) => setKey(e.target.value)} required placeholder="BASE_URL" />
            </label>
            <label className="block">
              <span className={cqaLabel}>Value</span>
              <input className={cqaInput} value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://staging.example" />
            </label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[12px] text-[#374151]">
              <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} className="size-3.5 accent-[#5b4ee8]" />
              Secret value
            </label>
            <button type="submit" className={cqaBtnPrimary} disabled={readOnly || pending === "var" || !key.trim()}>
              <CqaIcon name="add" className="text-[16px]" /> Add variable
            </button>
          </div>
          {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
        </form>
      </div>
    </Modal>
  );
}

function PermissionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Permission">
      {[
        { value: "RO", icon: "lock", title: "RO", hint: "Read only" },
        { value: "RW", icon: "edit", title: "RW", hint: "Read & write" },
      ].map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] transition",
            value === o.value ? "border-[#5b4ee8] bg-[#f5f3ff] text-[#4338ca]" : "border-[#e5e7eb] text-[#4b5563] hover:border-[#cbc6fb]",
          )}
        >
          <CqaIcon name={o.icon} className="text-[16px]" />
          <span className="font-semibold">{o.title}</span>
          <span className="text-[11px] text-[#9ca3af]">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

function DataProfileModal({
  open,
  envs,
  readOnly,
  onClose,
}: {
  open: boolean;
  envs: EnvCard[];
  readOnly: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [permission, setPermission] = useState("RO");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(2);
  const [environmentIds, setEnvironmentIds] = useState<string[]>([]);
  const [envOpen, setEnvOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setPermission("RO");
    setDescription("");
    setRows(3);
    setColumns(2);
    setEnvironmentIds([]);
    setEnvOpen(false);
    setError(null);
  }, [open, setError]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("profile", "/api/dashboard/environment-data", {
      json: { kind: "profile", name, permission, description, rows, columns, environmentIds },
    });
    if (res) {
      router.refresh();
      onClose();
    }
  }

  const selectedNames = envs.filter((env) => environmentIds.includes(env.id)).map((env) => env.name);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New test data profile"
      footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" form="profile-form" className={cqaBtnPrimary} disabled={readOnly || pending === "profile" || !name.trim() || environmentIds.length === 0}>
            {pending === "profile" ? "Creating…" : "Create profile"}
          </button>
        </>
      }
    >
      <form id="profile-form" onSubmit={submit} className="space-y-4">
        <p className="text-[12.5px] text-[#6b7280]">Define columns; data values can be added per environment after creation.</p>
        <label className="block">
          <span className={cqaLabel}>Profile name *</span>
          <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="e.g. Checkout test data" />
        </label>
        <div>
          <span className={cqaLabel}>Permission</span>
          <PermissionPicker value={permission} onChange={setPermission} />
        </div>
        <label className="block">
          <span className={cqaLabel}>Description</span>
          <textarea className="min-h-[70px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What data lives in this profile?" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={cqaLabel}>Rows</span>
            <input className={cqaInput} type="number" min={1} max={200} value={rows} onChange={(e) => setRows(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
          </label>
          <label className="block">
            <span className={cqaLabel}>Columns</span>
            <input className={cqaInput} type="number" min={1} max={50} value={columns} onChange={(e) => setColumns(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
          </label>
        </div>
        <div>
          <span className={cqaLabel}>Assign to environments *</span>
          <div className="rounded-lg border border-[#e5e7eb]">
            <button type="button" onClick={() => setEnvOpen((v) => !v)} aria-expanded={envOpen} className="flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] text-[#4b5563]">
              <span className={selectedNames.length ? "text-[#111827]" : "text-[#9ca3af]"}>
                {selectedNames.length ? selectedNames.join(", ") : "Select environments…"}
              </span>
              <CqaIcon name={envOpen ? "expand_less" : "expand_more"} className="text-[18px]" />
            </button>
            {envOpen && (
              <div className="max-h-[160px] space-y-1 overflow-y-auto border-t border-[#f0f1f3] p-2">
                {envs.length === 0 && <p className="px-1 py-2 text-[12px] text-[#9ca3af]">Create an environment first.</p>}
                {envs.map((env) => (
                  <label key={env.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                    <input
                      type="checkbox"
                      checked={environmentIds.includes(env.id)}
                      onChange={(e) => setEnvironmentIds((prev) => (e.target.checked ? [...prev, env.id] : prev.filter((id) => id !== env.id)))}
                      className="size-3.5 accent-[#5b4ee8]"
                    />
                    {env.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[#9ca3af]">Each environment gets an independent copy of the data (same columns, separate rows).</p>
        </div>
        {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

function GlobalVariableModal({
  open,
  readOnly,
  onClose,
}: {
  open: boolean;
  readOnly: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [type, setType] = useState("String");
  const [permission, setPermission] = useState("RO");
  const [value, setValue] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setType("String");
    setPermission("RO");
    setValue("");
    setTags([]);
    setTagDraft("");
    setDescription("");
    setError(null);
  }, [open, setError]);

  function addTag() {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagDraft("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("global", "/api/dashboard/environment-data", {
      json: { kind: "global", name, type, permission, value, tags, description },
    });
    if (res) {
      router.refresh();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New global variable"
      footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" form="global-form" className={cqaBtnPrimary} disabled={readOnly || pending === "global" || !name.trim()}>
            {pending === "global" ? "Creating…" : "Create variable"}
          </button>
        </>
      }
    >
      <form id="global-form" onSubmit={submit} className="space-y-4">
        <p className="text-[12.5px] text-[#6b7280]">Workspace-wide — accessible from any test case, any environment.</p>
        <label className="block">
          <span className={cqaLabel}>Name *</span>
          <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value)} required placeholder="WORKSPACE_ID" />
          <span className="mt-1 block text-[11px] text-[#9ca3af]">Names must be unique across the entire workspace (primary key — no duplicates).</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={cqaLabel}>Type</span>
            <select className={cqaInput} value={type} onChange={(e) => setType(e.target.value)}>
              <option>String</option>
              <option>Number</option>
              <option>Boolean</option>
              <option>Secret</option>
            </select>
          </label>
          <div>
            <span className={cqaLabel}>Permission</span>
            <PermissionPicker value={permission} onChange={setPermission} />
          </div>
        </div>
        <label className="block">
          <span className={cqaLabel}>Value</span>
          {type === "Boolean" ? (
            <select className={cqaInput} value={value || "false"} onChange={(e) => setValue(e.target.value)}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input className={cqaInput} type={type === "Secret" ? "password" : type === "Number" ? "number" : "text"} value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "Secret" ? "••••••••" : "Value"} />
          )}
        </label>
        <div>
          <span className={cqaLabel}>Tags (optional — for filtering &amp; grouping)</span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-medium text-[#4338ca]">
                {t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="text-[#818cf8] hover:text-[#4338ca]">
                  <CqaIcon name="close" className="text-[12px]" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              className={cqaInput}
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add tag"
            />
            <button type="button" className={cqaBtnSecondary} onClick={addTag}>
              <CqaIcon name="add" className="text-[16px]" /> Add tag
            </button>
          </div>
        </div>
        <label className="block">
          <span className={cqaLabel}>Description</span>
          <textarea className="min-h-[70px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this variable used for?" />
        </label>
        {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

function AuthProfileModal({
  open,
  defaultAppUrl,
  readOnly,
  onClose,
}: {
  open: boolean;
  defaultAppUrl: string;
  readOnly: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [method, setMethod] = useState("Username and password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [autoSignIn, setAutoSignIn] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [verifySelector, setVerifySelector] = useState("");
  const [otpHandling, setOtpHandling] = useState("Manual entry");

  useEffect(() => {
    if (!open) return;
    setName("");
    setAppUrl(defaultAppUrl);
    setLoginUrl("");
    setMethod("Username and password");
    setUsername("");
    setPassword("");
    setAutoSignIn(true);
    setAdvancedOpen(false);
    setVerifySelector("");
    setOtpHandling("Manual entry");
    setError(null);
  }, [open, defaultAppUrl, setError]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("auth", "/api/dashboard/environment-data", {
      json: {
        kind: "auth",
        name,
        appUrl,
        loginUrl,
        method,
        username,
        password,
        autoSignIn,
        advanced: { verifySelector, otpHandling },
      },
    });
    if (res) {
      router.refresh();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add auth profile"
      footer={
        <>
          <p className="mr-auto max-w-[240px] text-[11px] leading-4 text-[#9ca3af]">Saving stores the profile only. Nothing signs in until you choose Run login.</p>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" form="auth-form" className={cqaBtnPrimary} disabled={readOnly || pending === "auth" || !name.trim() || !appUrl.trim()}>
            {pending === "auth" ? "Saving…" : "Add auth profile"}
          </button>
        </>
      }
    >
      <form id="auth-form" onSubmit={submit} className="space-y-4">
        <p className="text-[12.5px] text-[#6b7280]">How Ship signs in to your app. Passwords and codes are encrypted and never shown again.</p>
        <label className="block">
          <span className={cqaLabel}>Name *</span>
          <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="e.g. Acme staging login" />
        </label>
        <label className="block">
          <span className={cqaLabel}>App URL *</span>
          <input className={cqaInput} type="url" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} required placeholder="https://app.your-domain.com" />
        </label>
        <label className="block">
          <span className={cqaLabel}>Login URL <CqaIcon name="info" className="text-[13px] text-[#9ca3af]" /></span>
          <input className={cqaInput} type="url" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="https://app.your-domain.com/login" />
        </label>
        <label className="block">
          <span className={cqaLabel}>Sign-in method <CqaIcon name="info" className="text-[13px] text-[#9ca3af]" /></span>
          <select className={cqaInput} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>Username and password</option>
            <option>SSO</option>
            <option>API token</option>
            <option>Cookie</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={cqaLabel}>Username</span>
            <input className={cqaInput} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" placeholder="qa@your-domain.com" />
          </label>
          <label className="block">
            <span className={cqaLabel}>Password</span>
            <input className={cqaInput} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
          </label>
        </div>
        <div className="rounded-lg border border-[#f0f1f3] bg-[#fafafa] px-3 py-2.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12.5px] font-medium text-[#111827]">Sign in again automatically when the session expires</p>
              <p className="mt-0.5 text-[11.5px] text-[#9ca3af]">Saved as a preference. Whether Ship can repeat the sign-in without you is checked after the first sign-in.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoSignIn}
              aria-label="Sign in again automatically when the session expires"
              onClick={() => setAutoSignIn((v) => !v)}
              className={cn("relative h-[22px] w-[40px] shrink-0 rounded-full transition", autoSignIn ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
            >
              <span className={cn("absolute top-[3px] size-4 rounded-full bg-white shadow transition", autoSignIn ? "left-[21px]" : "left-[3px]")} />
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-[#e5e7eb]">
          <button type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[12.5px] font-medium text-[#374151]">
            <span className="inline-flex items-center gap-1.5"><CqaIcon name="shield" className="text-[16px] text-[#6b7280]" /> Advanced · how Ship confirms the sign-in</span>
            <CqaIcon name={advancedOpen ? "expand_less" : "expand_more"} className="text-[18px]" />
          </button>
          {advancedOpen && (
            <div className="space-y-3 border-t border-[#f0f1f3] px-3 py-3">
              <label className="block">
                <span className={cqaLabel}>Success selector</span>
                <input className={cqaInput} value={verifySelector} onChange={(e) => setVerifySelector(e.target.value)} placeholder="e.g. [data-testid=dashboard]" />
              </label>
              <label className="block">
                <span className={cqaLabel}>OTP handling</span>
                <select className={cqaInput} value={otpHandling} onChange={(e) => setOtpHandling(e.target.value)}>
                  <option>Manual entry</option>
                  <option>Email code</option>
                  <option>TOTP secret</option>
                </select>
              </label>
            </div>
          )}
        </div>
        {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

function ProxyModal({ open, readOnly, onClose }: { open: boolean; readOnly: boolean; onClose: () => void }) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(8080);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName("");
    setHost("");
    setPort(8080);
    setUsername("");
    setPassword("");
    setEnabled(true);
    setError(null);
  }, [open, setError]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("proxy", "/api/dashboard/environment-data", { json: { kind: "proxy", name, host, port, username, password, enabled } });
    if (res) {
      router.refresh();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Proxy"
      footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" form="proxy-form" className={cqaBtnPrimary} disabled={readOnly || pending === "proxy" || !name.trim() || !host.trim()}>
            {pending === "proxy" ? "Saving…" : "Add proxy"}
          </button>
        </>
      }
    >
      <form id="proxy-form" onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className={cqaLabel}>Name *</span>
          <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Corporate proxy" />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <label className="block">
            <span className={cqaLabel}>Host *</span>
            <input className={cqaInput} value={host} onChange={(e) => setHost(e.target.value)} required placeholder="proxy.internal" />
          </label>
          <label className="block">
            <span className={cqaLabel}>Port *</span>
            <input className={cqaInput} type="number" min={1} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value) || 8080)} required />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={cqaLabel}>Username</span>
            <input className={cqaInput} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
          </label>
          <label className="block">
            <span className={cqaLabel}>Password</span>
            <input className={cqaInput} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-[#374151]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-3.5 accent-[#5b4ee8]" /> Enabled
        </label>
        {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

function ViewportModal({ open, readOnly, onClose }: { open: boolean; readOnly: boolean; onClose: () => void }) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Desktop");
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategory("Desktop");
    setWidth(1280);
    setHeight(720);
    setError(null);
  }, [open, setError]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("viewport", "/api/dashboard/environment-data", { json: { kind: "viewport", name, category, width, height } });
    if (res) {
      router.refresh();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Viewport"
      footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" form="viewport-form" className={cqaBtnPrimary} disabled={readOnly || pending === "viewport" || !name.trim()}>
            {pending === "viewport" ? "Saving…" : "Add viewport"}
          </button>
        </>
      }
    >
      <form id="viewport-form" onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className={cqaLabel}>Name *</span>
          <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. iPad Pro" />
        </label>
        <label className="block">
          <span className={cqaLabel}>Category</span>
          <select className={cqaInput} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Mobile</option>
            <option>Tablet</option>
            <option>Desktop</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={cqaLabel}>Width *</span>
            <input className={cqaInput} type="number" min={100} max={5000} value={width} onChange={(e) => setWidth(Number(e.target.value) || 1280)} required />
          </label>
          <label className="block">
            <span className={cqaLabel}>Height *</span>
            <input className={cqaInput} type="number" min={100} max={5000} value={height} onChange={(e) => setHeight(Number(e.target.value) || 720)} required />
          </label>
        </div>
        {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

type ImportKind = "environments" | "profiles" | "global" | "auth" | null;

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [] as Array<Record<string, string>>;
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === "," && !quoted) {
        cells.push(current);
        current = "";
      } else current += ch;
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function ImportModal({
  kind,
  envs,
  readOnly,
  onClose,
}: {
  kind: ImportKind;
  envs: EnvCard[];
  readOnly: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);

  useEffect(() => {
    if (kind) {
      setFileName("");
      setRows([]);
      setError(null);
    }
  }, [kind, setError]);

  const meta: Record<Exclude<ImportKind, null>, { title: string; columns: string; sample: string }> = {
    environments: { title: "Import environments", columns: "name, baseUrl, description", sample: "Staging,https://staging.your-domain.com,Pre-release build" },
    profiles: { title: "Import test data profiles", columns: "name, description, permission", sample: "Checkout data,Card and address rows,RO" },
    global: { title: "Import global data", columns: "name, value, type, permission", sample: "WORKSPACE_ID,acme-qa,String,RO" },
    auth: { title: "Import auth profiles", columns: "name, appUrl, username, method", sample: "Staging login,https://staging.your-domain.com,qa@your-domain.com,Username and password" },
  };
  const current = kind ? meta[kind] : null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    if (file.name.endsWith(".json")) {
      try {
        const parsed = JSON.parse(text) as Array<Record<string, string>>;
        setRows(Array.isArray(parsed) ? parsed : []);
      } catch {
        setRows([]);
      }
    } else {
      setRows(parseCsv(text));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind || rows.length === 0) return;
    for (const row of rows) {
      if (kind === "environments") {
        await run("import", "/api/dashboard/environment-data", {
          json: { kind: "environment", name: row.name || row.environment || "Imported environment", baseUrl: row.baseurl || row.url || "", description: row.description || "" },
        });
      } else if (kind === "profiles") {
        await run("import", "/api/dashboard/environment-data", {
          json: {
            kind: "profile",
            name: row.name || "Imported profile",
            description: row.description || "",
            permission: row.permission === "RW" ? "RW" : "RO",
            rows: 3,
            columns: 2,
            environmentIds: envs.map((env) => env.id),
          },
        });
      } else if (kind === "global") {
        await run("import", "/api/dashboard/environment-data", {
          json: {
            kind: "global",
            name: (row.name || "IMPORTED_VAR").replace(/[^A-Za-z0-9_]/g, "_"),
            value: row.value || "",
            type: ["String", "Number", "Boolean", "Secret"].includes(row.type) ? row.type : "String",
            permission: row.permission === "RW" ? "RW" : "RO",
            tags: [],
            description: row.description || "",
          },
        });
      } else {
        await run("import", "/api/dashboard/environment-data", {
          json: {
            kind: "auth",
            name: row.name || "Imported login",
            appUrl: row.appurl || row.url || "",
            loginUrl: row.loginurl || "",
            method: row.method || "Username and password",
            username: row.username || "",
            password: row.password || "",
            autoSignIn: true,
            advanced: {},
          },
        });
      }
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal
      open={kind !== null}
      onClose={onClose}
      title={current?.title ?? "Import"}
      footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" form="import-form" className={cqaBtnPrimary} disabled={readOnly || pending === "import" || rows.length === 0}>
            {pending === "import" ? "Importing…" : `Import ${rows.length || ""} row${rows.length === 1 ? "" : "s"}`}
          </button>
        </>
      }
    >
      <form id="import-form" onSubmit={submit} className="space-y-4">
        <p className="text-[12.5px] text-[#6b7280]">Upload a CSV or JSON file. Expected columns: <code className="rounded bg-[#f3f4f6] px-1 py-0.5 text-[11px]">{current?.columns}</code></p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#d1d5db] bg-[#fafafa] px-4 py-8 text-center transition hover:border-[#a9a1f7] hover:bg-[#f5f3ff]"
        >
          <CqaIcon name="cloud_upload" className="text-[28px] text-[#9ca3af]" />
          <span className="text-[13px] font-medium text-[#374151]">{fileName || "Click to choose a file"}</span>
          <span className="text-[11.5px] text-[#9ca3af]">CSV or JSON · {rows.length} row{rows.length === 1 ? "" : "s"} detected</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="rounded-lg bg-[#f9fafb] px-3 py-2 text-[11.5px] text-[#6b7280]">
          <p className="font-medium text-[#374151]">Sample row</p>
          <code className="mt-0.5 block break-all">{current?.sample}</code>
        </div>
        {rows.length > 0 && (
          <div className="max-h-[140px] overflow-y-auto rounded-lg border border-[#e5e7eb]">
            <table className="w-full text-left text-[11.5px]">
              <thead className="bg-[#fafafa] text-[#6b7280]">
                <tr>{Object.keys(rows[0]).map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-[#f3f4f6]">
                    {Object.keys(rows[0]).map((h) => <td key={h} className="max-w-[160px] truncate px-2 py-1.5 text-[#4b5563]">{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}


