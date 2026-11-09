"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

export interface ParityTestCase {
  id: string;
  code: string;
  title: string;
  module: string;
  criticality: string;
  status: string;
  stepsCount: number;
  source: string;
  labels: string[];
  createdBy: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
}

export interface ParityStepGroup {
  id: string;
  name: string;
  description: string;
  stepsCount: number;
  createdAt: string;
}

const COLUMNS = [
  "Type",
  "Priority",
  "Result",
  "Status",
  "Module",
  "Labels",
  "Created By",
  "Folder",
  "Created At",
  "Updated At",
  "Last Run",
] as const;

const FILTERS = [
  { key: "createdBy", label: "Created By", options: ["Any user"] },
  { key: "status", label: "Status", options: ["Any status", "Ready", "In Review", "Draft"] },
  { key: "testType", label: "Test Type", options: ["Any test type", "Functional", "End to End", "Regression"] },
  { key: "type", label: "Type", options: ["Any type", "Positive", "Negative", "Edge Case"] },
  { key: "priority", label: "Priority", options: ["Any priority", "High", "Medium", "Low"] },
  { key: "result", label: "Latest Run Result", options: ["Any result", "Passed", "Failed", "Not Executed"] },
  { key: "suite", label: "Added to Suite", options: ["Any", "Yes", "No"] },
  { key: "module", label: "Module", options: ["Any module"] },
  { key: "createdDate", label: "Created Date", options: ["Any time", "Today", "Last 7 days", "Last 30 days"] },
  { key: "updatedDate", label: "Updated Date", options: ["Any time", "Today", "Last 7 days", "Last 30 days"] },
  { key: "labels", label: "Labels", options: ["Any label"] },
  { key: "requirements", label: "Requirements", options: ["Any requirement"] },
];

function priorityOf(criticality: string) {
  if (criticality === "critical" || criticality === "high") return "High";
  if (criticality === "medium") return "Medium";
  return "Low";
}

function resultOf(status: string) {
  if (status === "passing") return "Passed";
  if (status === "failing" || status === "flaky") return "Failed";
  return "Not Executed";
}

function stateOf(status: string) {
  if (status === "passing") return "Ready";
  if (status === "failing" || status === "flaky") return "In Review";
  return "Draft";
}

function fmt(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TestCasesParity({
  rows,
  groups,
  modules,
  readOnly,
  openNew,
  initialTab,
  userName,
}: {
  rows: ParityTestCase[];
  groups: ParityStepGroup[];
  modules: string[];
  readOnly: boolean;
  openNew: boolean;
  initialTab: "cases" | "groups";
  userName: string;
}) {
  const router = useRouter();
  const { run } = useAction();
  const [tab, setTab] = useState<"cases" | "groups">(initialTab);
  const [view, setView] = useState<"list" | "modular">("list");
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("All Test Cases");
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(openNew && !readOnly);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>(
    Object.fromEntries(FILTERS.map((f) => [f.key, f.options[0]])),
  );
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(COLUMNS.map((c) => [c, true])),
  );
  const [autoRefresh, setAutoRefresh] = useState("Off");
  const [folder, setFolder] = useState<string>("All");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (q && !`${r.title} ${r.code} ${r.module}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (scope === "My Test Cases" && r.createdBy !== userName) return false;
        if (folder !== "All" && r.module !== folder) return false;
        if (filters.status !== "Any status" && stateOf(r.status) !== filters.status) return false;
        if (filters.priority !== "Any priority" && priorityOf(r.criticality) !== filters.priority) return false;
        if (filters.result !== "Any result" && resultOf(r.status) !== filters.result) return false;
        if (filters.module !== "Any module" && r.module !== filters.module) return false;
        return true;
      }),
    [rows, q, scope, folder, filters, userName],
  );

  const filteredGroups = groups.filter((g) => !q || `${g.name} ${g.description}`.toLowerCase().includes(q.toLowerCase()));

  async function deleteCase(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await run(`del-${id}`, `/api/dashboard/test-cases/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function updateModule(id: string, current: string) {
    const module = window.prompt("Update module", current);
    if (!module) return;
    await run(`mod-${id}`, `/api/dashboard/test-cases/${id}`, { method: "PATCH", json: { action: "edit", module } });
    router.refresh();
  }

  async function deleteGroup(id: string) {
    if (!window.confirm("Delete this step group?")) return;
    await fetch(`/api/dashboard/test-components?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    router.refresh();
  }

  const heading = tab === "cases" ? "Test Cases" : "Step Groups";
  const subheading =
    tab === "cases"
      ? "Manage and Execute all your Test Cases"
      : "Manage and organize reusable step groups";

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-[#111827]">{heading}</h1>
        <p className="mt-1 text-[13.5px] leading-5 text-[#6b7280]">{subheading}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-6 border-b border-[#e5e7eb]">
          {(
            [
              { key: "cases", label: "Test Cases" },
              { key: "groups", label: "Step Groups" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px border-b-2 pb-2.5 pt-1 text-[13px] transition",
                tab === t.key ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280] hover:text-[#111827]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-[12.5px]">
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1.5", view === "list" ? "bg-[#f3f4f6] text-[#111827]" : "text-[#6b7280] hover:bg-[#f9fafb]")}
          >
            <CqaIcon name="view_list" className="text-[17px]" /> List
          </button>
          <button
            type="button"
            onClick={() => setView("modular")}
            className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1.5", view === "modular" ? "bg-[#f3f4f6] text-[#111827]" : "text-[#6b7280] hover:bg-[#f9fafb]")}
          >
            <CqaIcon name="folder" className="text-[17px]" /> Modular
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
          <input
            type="search"
            aria-label="Search"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] outline-none placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
          />
        </div>
        {tab === "cases" ? (
          <select aria-label="Scope" className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[12.5px] text-[#374151]" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option>All Test Cases</option>
            <option>My Test Cases</option>
            <option>Suite Cases</option>
          </select>
        ) : (
          <select aria-label="All Step Groups" className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[12.5px] text-[#374151]">
            <option>All Step Groups</option>
          </select>
        )}
        <button type="button" className={cqaBtnSecondary} onClick={() => setFilterOpen(true)}>
          <CqaIcon name="add" className="text-[16px]" /> Filter
        </button>
        <button type="button" className={cn(cqaIconBtn, "size-9 border border-[#e5e7eb] bg-white")} aria-label="Table settings" onClick={() => setSettingsOpen((v) => !v)}>
          <CqaIcon name="settings" className="text-[18px]" />
        </button>
        <button type="button" className={cn(cqaIconBtn, "size-9 border border-[#e5e7eb] bg-white")} aria-label="Refresh" onClick={() => router.refresh()}>
          <CqaIcon name="refresh" className="text-[18px]" />
        </button>
        {tab === "cases" ? (
          <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setNewOpen(true)}>
            <CqaIcon name="add" className="text-[17px]" /> New Test Case
          </button>
        ) : (
          <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setNewGroupOpen(true)}>
            <CqaIcon name="add" className="text-[17px]" /> New Step Group
          </button>
        )}
      </div>

      {tab === "cases" && settingsOpen && (
        <div className="ml-auto w-full max-w-[420px] rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#111827]">Table settings</p>
            <button type="button" aria-label="Close settings" className={cqaIconBtn} onClick={() => setSettingsOpen(false)}>
              <CqaIcon name="close" className="text-[18px]" />
            </button>
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Show Columns</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {COLUMNS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-[12.5px] text-[#374151]">
                <input
                  type="checkbox"
                  checked={visibleColumns[c]}
                  onChange={(e) => setVisibleColumns((v) => ({ ...v, [c]: e.target.checked }))}
                  className="size-3.5 accent-[#5b4ee8]"
                />
                {c}
              </label>
            ))}
          </div>
          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Auto refresh</p>
          <div className="flex flex-wrap gap-3">
            {["10s", "20s", "30s", "Off"].map((v) => (
              <label key={v} className="flex items-center gap-1.5 text-[12.5px] text-[#374151]">
                <input type="radio" name="auto-refresh" checked={autoRefresh === v} onChange={() => setAutoRefresh(v)} className="size-3.5 accent-[#5b4ee8]" />
                {v}
              </label>
            ))}
          </div>
        </div>
      )}

      {tab === "groups" ? (
        view === "modular" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.length === 0 && (
              <div className={cn(cqaCard, "col-span-full px-5 py-14 text-center")}>
                <p className="text-[14px] font-medium text-[#374151]">No data available</p>
                <p className="mt-1 text-[12.5px] text-[#9ca3af]">There is no data available to display.</p>
              </div>
            )}
            {filteredGroups.map((group) => (
              <div key={group.id} className={cn(cqaCard, "p-4")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CqaIcon name="folder_copy" className="text-[18px] text-[#5b4ee8]" />
                    <p className="text-[13px] font-semibold text-[#1f2937]">{group.name}</p>
                  </div>
                  <button type="button" aria-label={`Delete ${group.name}`} disabled={readOnly} onClick={() => deleteGroup(group.id)} className="text-[#9ca3af] hover:text-[#dc2626] disabled:opacity-40">
                    <CqaIcon name="delete" className="text-[16px]" />
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 min-h-[32px] text-[12px] text-[#6b7280]">{group.description || "No description"}</p>
                <div className="mt-3 flex items-center justify-between border-t border-[#f0f1f3] pt-2 text-[11.5px] text-[#6b7280]">
                  <span>{group.stepsCount} steps</span>
                  <span>{new Date(group.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <StepGroupsTable groups={filteredGroups} readOnly={readOnly} onDelete={deleteGroup} />
        )
      ) : view === "modular" ? (
        <ModularView
          rows={rows}
          modules={modules}
          folder={folder}
          setFolder={setFolder}
          onOpenCase={(id) => router.push(`/dashboard/test-studio/${id}`)}
        />
      ) : (
        <CasesTable
          rows={filtered}
          visible={visibleColumns}
          readOnly={readOnly}
          onDelete={deleteCase}
          onUpdateModule={updateModule}
        />
      )}

      {/* Filter drawer */}
      {filterOpen && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Filters">
          <div className="absolute inset-0 bg-[#0f172a]/30" onClick={() => setFilterOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[#f0f1f3] px-5 py-4">
              <h2 className="text-[16px] font-semibold text-[#111827]">Filters</h2>
              <button type="button" className={cqaIconBtn} aria-label="Close filters" onClick={() => setFilterOpen(false)}>
                <CqaIcon name="close" className="text-[20px]" />
              </button>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {FILTERS.map((f) => (
                <label key={f.key} className="block">
                  <span className={cqaLabel}>{f.label}</span>
                  <select
                    className={cqaInput}
                    value={filters[f.key]}
                    onChange={(e) => setFilters((v) => ({ ...v, [f.key]: e.target.value }))}
                  >
                    {f.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                    {f.key === "module" && modules.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-[#f0f1f3] px-5 py-3.5">
              <button type="button" className={cqaBtnSecondary} onClick={() => setFilters(Object.fromEntries(FILTERS.map((f) => [f.key, f.options[0]])))}>
                Reset
              </button>
              <button type="button" className={cqaBtnPrimary} onClick={() => setFilterOpen(false)}>
                Apply Filter
              </button>
            </footer>
          </aside>
        </div>
      )}

      <NewTestCaseModal open={newOpen} onClose={() => setNewOpen(false)} modules={modules} readOnly={readOnly} />
      <NewStepGroupModal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} readOnly={readOnly} cases={rows} />
    </div>
  );
}

function CasesTable({
  rows,
  visible,
  readOnly,
  onDelete,
  onUpdateModule,
}: {
  rows: ParityTestCase[];
  visible: Record<string, boolean>;
  readOnly: boolean;
  onDelete: (id: string, title: string) => void;
  onUpdateModule: (id: string, current: string) => void;
}) {
  return (
    <div className={cn(cqaCard, "overflow-hidden")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#f0f1f3]">
              <th className="w-9 px-3 py-3">
                <input type="checkbox" aria-label="Select all" className="size-3.5 accent-[#5b4ee8]" />
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Test Case</th>
              <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Action</th>
              {visible.Type && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Type</th>}
              {visible.Priority && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Priority</th>}
              {visible.Result && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Result</th>}
              {visible.Status && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Status</th>}
              {visible.Module && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Module</th>}
              {visible.Labels && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Labels</th>}
              {visible["Created By"] && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Created By</th>}
              {visible.Folder && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Folder</th>}
              {visible["Created At"] && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Created At</th>}
              {visible["Updated At"] && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Updated At</th>}
              {visible["Last Run"] && <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Last Run</th>}
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={14} className="px-4 py-16 text-center">
                  <p className="text-[14px] font-medium text-[#374151]">No data available</p>
                  <p className="mt-1 text-[12.5px] text-[#9ca3af]">No test cases match the current filters.</p>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const priority = priorityOf(r.criticality);
              return (
                <tr key={r.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                  <td className="px-3 py-3">
                    <input type="checkbox" aria-label={`Select ${r.title}`} className="size-3.5 accent-[#5b4ee8]" />
                  </td>
                  <td className="max-w-[360px] px-3 py-3">
                    <p className="text-[10px] font-medium text-[#9ca3af]">{r.code}</p>
                    <Link href={`/dashboard/test-studio/${r.id}`} className="line-clamp-2 font-medium text-[#1f2937] hover:text-[#5b4ee8]">
                      {r.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-[#6b7280]">{r.source === "manual" ? "Manual" : "Automated"}</td>
                  {visible.Type && <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-[#4b5563]">Functional</td>}
                  {visible.Priority && (
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#4b5563]">
                        <span className={cn("size-2 rounded-full", priority === "High" ? "bg-[#ef4444]" : priority === "Medium" ? "bg-[#f59e0b]" : "bg-[#9ca3af]")} />
                        {priority}
                      </span>
                    </td>
                  )}
                  {visible.Result && <td className="px-3 py-3"><StatusPill value={resultOf(r.status)} /></td>}
                  {visible.Status && <td className="px-3 py-3"><StatusPill value={stateOf(r.status)} /></td>}
                  {visible.Module && <td className="whitespace-nowrap px-3 py-3 capitalize text-[#4b5563]">{r.module}</td>}
                  {visible.Labels && (
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.labels.slice(0, 2).map((l) => (
                          <span key={l} className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[11px] text-[#4b5563]">{l}</span>
                        ))}
                      </div>
                    </td>
                  )}
                  {visible["Created By"] && <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-[#4b5563]">{r.createdBy}</td>}
                  {visible.Folder && <td className="whitespace-nowrap px-3 py-3 text-[12.5px] capitalize text-[#4b5563]">{r.folder}</td>}
                  {visible["Created At"] && <td className="whitespace-nowrap px-3 py-3 text-[12px] text-[#6b7280]">{fmt(r.createdAt)}</td>}
                  {visible["Updated At"] && <td className="whitespace-nowrap px-3 py-3 text-[12px] text-[#6b7280]">{fmt(r.updatedAt)}</td>}
                  {visible["Last Run"] && <td className="whitespace-nowrap px-3 py-3 text-[12px] text-[#6b7280]">{fmt(r.lastRunAt)}</td>}
                  <td className="px-3 py-3">
                    <details className="relative">
                      <summary aria-label="More actions" className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6] [&::-webkit-details-marker]:hidden">
                        <CqaIcon name="more_horiz" className="text-[20px]" />
                      </summary>
                      <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
                        <Link href={`/dashboard/test-studio/${r.id}`} className="flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                          <CqaIcon name="visibility" className="text-[17px]" /> View
                        </Link>
                        <Link href={`/dashboard/test-studio/${r.id}`} className="flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                          <CqaIcon name="edit_square" className="text-[17px]" /> Edit
                        </Link>
                        <button type="button" disabled={readOnly} onClick={() => onUpdateModule(r.id, r.module)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                          <CqaIcon name="category" className="text-[17px]" /> Update Module
                        </button>
                        <button type="button" disabled={readOnly} onClick={() => onDelete(r.id, r.title)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#dc2626] hover:bg-[#fef2f2]">
                          <CqaIcon name="delete" className="text-[17px]" /> Delete
                        </button>
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select aria-label="Rows per page" className="h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]" defaultValue="10">
            <option>10</option>
            <option>20</option>
            <option>50</option>
          </select>
        </div>
        <span className="tabular-nums">1–{Math.min(rows.length, 10)} of {rows.length}</span>
      </div>
    </div>
  );
}

function StepGroupsTable({ groups, readOnly, onDelete }: { groups: ParityStepGroup[]; readOnly: boolean; onDelete: (id: string) => void }) {
  return (
    <div className={cn(cqaCard, "overflow-hidden")}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[#f0f1f3]">
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Name</th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Description</th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Steps</th>
            <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Created Date</th>
            <th className="w-10 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-16 text-center">
                <p className="text-[14px] font-medium text-[#374151]">No data available</p>
                <p className="mt-1 text-[12.5px] text-[#9ca3af]">There is no data available to display.</p>
              </td>
            </tr>
          )}
          {groups.map((g) => (
            <tr key={g.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
              <td className="px-4 py-3 font-medium text-[#1f2937]">{g.name}</td>
              <td className="px-4 py-3 text-[12.5px] text-[#6b7280]">{g.description || "-"}</td>
              <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{g.stepsCount}</td>
              <td className="px-4 py-3 text-[12px] text-[#6b7280]">{fmt(g.createdAt)}</td>
              <td className="px-4 py-3">
                <details className="relative">
                  <summary aria-label="More actions" className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6] [&::-webkit-details-marker]:hidden">
                    <CqaIcon name="more_horiz" className="text-[20px]" />
                  </summary>
                  <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
                    <Link href="/dashboard/test-studio" className="flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                      <CqaIcon name="input" className="text-[17px]" /> Insert in Studio
                    </Link>
                    <button type="button" disabled={readOnly} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                      <CqaIcon name="edit_square" className="text-[17px]" /> Edit
                    </button>
                    <button type="button" disabled={readOnly} onClick={() => onDelete(g.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#dc2626] hover:bg-[#fef2f2]">
                      <CqaIcon name="delete" className="text-[17px]" /> Delete
                    </button>
                  </div>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModularView({
  rows,
  modules,
  folder,
  setFolder,
  onOpenCase,
}: {
  rows: ParityTestCase[];
  modules: string[];
  folder: string;
  setFolder: (f: string) => void;
  onOpenCase: (id: string) => void;
}) {
  const [folderQ, setFolderQ] = useState("");
  const shown = modules.filter((m) => !folderQ || m.toLowerCase().includes(folderQ.toLowerCase()));
  const unorganised = rows.filter((r) => !r.module).length;
  return (
    <div className={cn(cqaCard, "grid min-h-[420px] grid-cols-1 lg:grid-cols-[260px_1fr]")}>
      <aside className="border-b border-[#f0f1f3] p-4 lg:border-b-0 lg:border-r">
        <div className="relative mb-3">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#9ca3af]" />
          <input
            aria-label="Search folders"
            placeholder="Search folders"
            value={folderQ}
            onChange={(e) => setFolderQ(e.target.value)}
            className="h-8 w-full rounded-md border border-[#e5e7eb] pl-8 pr-2 text-[12px] outline-none focus:border-[#a9a1f7]"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Organized</p>
          <button type="button" className="text-[11.5px] font-medium text-[#5b4ee8]">New folder</button>
        </div>
        <button
          type="button"
          onClick={() => setFolder("All")}
          className={cn("mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px]", folder === "All" ? "bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "text-[#374151] hover:bg-[#f9fafb]")}
        >
          <CqaIcon name="folder" className="text-[17px]" /> All test cases
          <span className="ml-auto text-[11px] text-[#9ca3af]">{rows.length}</span>
        </button>
        <div className="mt-1 space-y-0.5">
          {shown.map((m) => {
            const count = rows.filter((r) => r.module === m).length;
            return (
              <button
                type="button"
                key={m}
                onClick={() => setFolder(m)}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]", folder === m ? "bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "text-[#374151] hover:bg-[#f9fafb]")}
              >
                <CqaIcon name="folder" className="text-[17px] text-[#9ca3af]" />
                <span className="truncate capitalize">{m}</span>
                <span className="ml-auto text-[11px] text-[#9ca3af]">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 border-t border-[#f0f1f3] pt-3">
          <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
            <CqaIcon name="folder_off" className="text-[17px] text-[#9ca3af]" /> Unorganized
            <span className="ml-auto text-[11px] text-[#9ca3af]">{unorganised}</span>
          </button>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          {["New folder", "Rename", "Move folder", "Delete folder"].map((a) => (
            <button key={a} type="button" className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10.5px] text-[#6b7280] hover:bg-[#e5e7eb]">
              {a}
            </button>
          ))}
        </div>
      </aside>
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[#111827]">{folder === "All" ? "All test cases" : folder}</h2>
          <span className="text-[12px] text-[#6b7280]">{rows.filter((r) => folder === "All" || r.module === folder).length} cases</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows
            .filter((r) => folder === "All" || r.module === folder)
            .slice(0, 12)
            .map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenCase(r.id)}
                className="rounded-lg border border-[#e5e7eb] bg-white p-3 text-left transition hover:border-[#cbc6fb] hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-medium text-[#9ca3af]">{r.code}</span>
                  <StatusPill value={stateOf(r.status)} />
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium text-[#1f2937]">{r.title}</p>
                <p className="mt-2 text-[11px] capitalize text-[#6b7280]">{r.module} · {r.stepsCount} steps</p>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function NewTestCaseModal({ open, onClose, modules, readOnly }: { open: boolean; onClose: () => void; modules: string[]; readOnly: boolean }) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [method, setMethod] = useState<"ai" | "import" | "record" | "manual">("ai");
  const [step, setStep] = useState(1);
  const [module, setModule] = useState(modules[0] ?? "Core");
  const [priority, setPriority] = useState("medium");
  const [title, setTitle] = useState("");
  const [stepsCount, setStepsCount] = useState(3);
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [requirementName, setRequirementName] = useState("");
  const [count, setCount] = useState(3);

  const methods = [
    { id: "ai", icon: "auto_awesome", title: "AI Assistance", blurb: "Describe your feature and let AI generate comprehensive test cases instantly." },
    { id: "import", icon: "upload_file", title: "Import Files", blurb: "Upload requirements docs or test spreadsheets to extract and generate test cases." },
    { id: "record", icon: "videocam", title: "Record & Play", blurb: "Record browser interactions and automatically convert them into reusable test steps." },
    { id: "manual", icon: "edit_note", title: "Create manually", blurb: "Define steps and expected results by hand." },
  ] as const;

  function close() {
    setError(null);
    setStep(1);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (method === "record") {
      router.push(`/dashboard/recorder${url ? `?url=${encodeURIComponent(url)}` : ""}`);
      close();
      return;
    }
    if (method === "import") {
      const parsed = prompt
        .split("\n")
        .map((line) => line.split(","))
        .filter((parts) => parts.length >= 2 && parts[0] && parts[1]);
      for (const [t, m] of parsed) {
        await run("import", "/api/dashboard/test-cases", { json: { mode: "manual", title: t.trim(), module: (m || module).trim(), criticality: priority, stepsCount } });
      }
      router.refresh();
      close();
      return;
    }
    const json =
      method === "manual"
        ? { mode: "manual", title, module, criticality: priority, stepsCount }
        : { mode: "ai", module, criticality: priority, prompt: prompt || (url ? `Explore ${url}` : ""), count };
    const res = await run("create", "/api/dashboard/test-cases", { json });
    if (res) {
      router.refresh();
      close();
    }
  }

  return (
    <Modal open={open} onClose={close} title="Create Test Case" size="lg">
      <form onSubmit={submit} className="space-y-5">
        <p className="text-[13px] text-[#6b7280]">Choose the method that fits your workflow. You can always switch later.</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Step {step} of 2</p>
        {step === 1 ? (
          <div className="space-y-2">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                aria-pressed={method === m.id}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition",
                  method === m.id ? "border-[#5b4ee8] bg-[#f5f3ff] ring-2 ring-[#e4e1fd]" : "border-[#e5e7eb] hover:border-[#cbc6fb]",
                )}
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", method === m.id ? "bg-[#5b4ee8] text-white" : "bg-[#f3f4f6] text-[#6b7280]")}>
                  <CqaIcon name={m.icon} className="text-[20px]" />
                </span>
                <span>
                  <span className="block text-[13.5px] font-medium text-[#111827]">{m.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-5 text-[#6b7280]">{m.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(method === "ai" || method === "record") && (
              <label className="block">
                <span className={cqaLabel}>Target URL</span>
                <input className={cqaInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter a URL…" type="url" />
              </label>
            )}
            {method === "ai" && (
              <>
                <label className="block">
                  <span className={cqaLabel}>Prompt</span>
                  <textarea
                    className="min-h-[88px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={500}
                    placeholder="Sign in, add a product, apply a coupon, complete checkout. Cover payment validation."
                  />
                </label>
                <label className="block">
                  <span className={cqaLabel}>Requirement name (optional)</span>
                  <input className={cqaInput} value={requirementName} onChange={(e) => setRequirementName(e.target.value)} placeholder="Requirement name (optional)" />
                </label>
              </>
            )}
            {method === "import" && (
              <label className="block">
                <span className={cqaLabel}>Paste CSV / JSON / Markdown requirements</span>
                <textarea
                  className="min-h-[120px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 font-mono text-[12px] outline-none focus:border-[#a9a1f7]"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={"title,module\nReset password,Account Recovery\nSign in with SSO,User Sign-In"}
                />
              </label>
            )}
            {method === "record" && (
              <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fafafa] px-4 py-5 text-center text-[12px] text-[#6b7280]">
                <CqaIcon name="extension" className="text-[28px] text-[#9ca3af]" />
                <p className="mt-1">Record &amp; Play opens the recorder with this URL pre-filled.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={cqaLabel}>Module</span>
                <select className={cqaInput} value={module} onChange={(e) => setModule(e.target.value)}>
                  {modules.map((m) => <option key={m}>{m}</option>)}
                  <option>Core</option>
                </select>
              </label>
              <label className="block">
                <span className={cqaLabel}>Priority</span>
                <select className={cqaInput} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>
            {method === "manual" ? (
              <>
                <label className="block">
                  <span className={cqaLabel}>Title</span>
                  <input className={cqaInput} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} placeholder="User can reset their password" />
                </label>
                <label className="block">
                  <span className={cqaLabel}>Steps</span>
                  <input className={cqaInput} type="number" min={1} max={50} value={stepsCount} onChange={(e) => setStepsCount(Number(e.target.value) || 1)} />
                </label>
              </>
            ) : (
              <label className="block">
                <span className={cqaLabel}>How many test cases</span>
                <input className={cqaInput} type="number" min={1} max={4} value={count} onChange={(e) => setCount(Math.min(4, Math.max(1, Number(e.target.value) || 1)))} />
              </label>
            )}
          </div>
        )}
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-[#f0f1f3] pt-4">
          <button type="button" className={cqaBtnSecondary} onClick={close}>Cancel</button>
          {step === 1 ? (
            <button type="button" className={cqaBtnPrimary} onClick={() => setStep(2)}>Get started <CqaIcon name="arrow_forward" className="text-[17px]" /></button>
          ) : (
            <>
              <button type="button" className={cqaBtnSecondary} onClick={() => setStep(1)}>Back</button>
              <button type="submit" className={cqaBtnPrimary} disabled={readOnly || pending === "create"}>
                {pending === "create" ? "Creating…" : "Create Test Case"}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}

const RICH_TOOLS: Array<{ icon: string; label: string }> = [
  { icon: "format_bold", label: "Bold" },
  { icon: "format_italic", label: "Italic" },
  { icon: "strikethrough_s", label: "Strikethrough" },
  { icon: "link", label: "Link" },
  { icon: "title", label: "Heading" },
  { icon: "format_quote", label: "Quote" },
  { icon: "code", label: "Code" },
  { icon: "format_list_bulleted", label: "Bullets" },
  { icon: "format_list_numbered", label: "Numbers" },
  { icon: "format_indent_decrease", label: "Decrease Level" },
  { icon: "format_indent_increase", label: "Increase Level" },
  { icon: "undo", label: "Undo" },
  { icon: "redo", label: "Redo" },
];

function RichToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-[#e5e7eb] bg-[#fafafa] px-2 py-1.5">
      {RICH_TOOLS.map((tool) => (
        <button
          key={tool.label}
          type="button"
          title={tool.label}
          aria-label={tool.label}
          onMouseDown={(event) => event.preventDefault()}
          className="rounded p-1 text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#374151]"
        >
          <CqaIcon name={tool.icon} className="text-[16px]" />
        </button>
      ))}
    </div>
  );
}

function NewStepGroupModal({
  open,
  onClose,
  readOnly,
  cases,
}: {
  open: boolean;
  onClose: () => void;
  readOnly: boolean;
  cases: ParityTestCase[];
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [advanced, setAdvanced] = useState(true);
  const [status, setStatus] = useState("Any");
  const [selectedPrereqs, setSelectedPrereqs] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [mobileTesting, setMobileTesting] = useState(false);
  const [extensionUse, setExtensionUse] = useState(false);

  function addLabel() {
    const next = labelDraft.trim();
    if (!next || labels.includes(next)) return;
    setLabels((prev) => [...prev, next]);
    setLabelDraft("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("sg", "/api/dashboard/test-components", {
      json: { name, description, steps: [{ id: "g1", action: "Click", target: "primary action", value: "", selector: "" }] },
    });
    if (res) {
      setName("");
      setDescription("");
      setLabels([]);
      setSelectedPrereqs([]);
      setStatus("Any");
      setError(null);
      router.refresh();
      onClose();
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Create Step Group" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={cqaLabel}>Name *</span>
          <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="e.g. Sign in as a returning user" />
        </label>

        <button
          type="button"
          onClick={() => setAdvanced((value) => !value)}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#5b4ee8] hover:underline"
        >
          {advanced ? "Hide Advanced Options" : "Show Advanced Options"}
          <CqaIcon name={advanced ? "expand_less" : "expand_more"} className="text-[16px]" />
        </button>

        {advanced && (
          <div className="space-y-4 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3.5">
            <label className="block">
              <span className={cqaLabel}>Status</span>
              <select className={cqaInput} value={status} onChange={(e) => setStatus(e.target.value)}>
                {["Any", "Ready", "In Review", "Draft"].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>

            <div>
              <span className={cqaLabel}>Selected Prerequisites</span>
              <div className="max-h-32 overflow-y-auto rounded-md border border-[#e5e7eb] bg-white">
                {cases.length === 0 && <p className="px-3 py-2 text-[12px] text-[#9ca3af]">No prerequisites selected</p>}
                {cases.map((candidate) => (
                  <label key={candidate.id} className="flex cursor-pointer items-start gap-2 border-b border-[#f3f4f6] px-3 py-2 last:border-0 hover:bg-[#fafafa]">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 accent-[#5b4ee8]"
                      checked={selectedPrereqs.includes(candidate.id)}
                      onChange={() => setSelectedPrereqs((prev) => (prev.includes(candidate.id) ? prev.filter((id) => id !== candidate.id) : [...prev, candidate.id]))}
                    />
                    <span className="min-w-0 text-[12.5px] text-[#374151]">{candidate.title}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11.5px] text-[#6b7280]">{selectedPrereqs.length === 0 ? "No prerequisites selected" : `${selectedPrereqs.length} selected`}</p>
            </div>

            <div>
              <span className={cqaLabel}>Labels</span>
              <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-2 py-1.5">
                {labels.map((label) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-1.5 py-[2px] text-[11.5px] text-[#374151]">
                    {label}
                    <button type="button" aria-label={`Remove ${label}`} onClick={() => setLabels((prev) => prev.filter((value) => value !== label))} className="text-[#9ca3af] hover:text-[#dc2626]">
                      <CqaIcon name="close" className="text-[11px]" />
                    </button>
                  </span>
                ))}
                <input
                  value={labelDraft}
                  onChange={(event) => setLabelDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addLabel();
                    }
                  }}
                  placeholder="Search or add tag"
                  className="h-6 min-w-[130px] flex-1 border-0 px-1 text-[12px] outline-none placeholder:text-[#9ca3af]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="inline-flex items-center gap-2 text-[12.5px] text-[#374151]">
                <input type="checkbox" checked={mobileTesting} onChange={(e) => setMobileTesting(e.target.checked)} className="size-3.5 accent-[#5b4ee8]" />
                Mobile Testing
              </label>
              <label className="inline-flex items-center gap-2 text-[12.5px] text-[#374151]">
                <input type="checkbox" checked={extensionUse} onChange={(e) => setExtensionUse(e.target.checked)} className="size-3.5 accent-[#5b4ee8]" />
                Extension Use
              </label>
            </div>
          </div>
        )}

        <div>
          <span className={cqaLabel}>Description(Optional)</span>
          <RichToolbar />
          <textarea
            className="min-h-[110px] w-full rounded-b-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a meaningful description for this Test Case."
          />
          <div className="mt-2 space-y-1 rounded-md border border-[#f0f1f3] bg-[#fafafa] px-3 py-2 text-[11.5px] leading-5 text-[#6b7280]">
            <p><span className="font-medium text-[#4a5565]">Description:</span> Enter a meaningful description for this Test Case.</p>
            <p><span className="font-medium text-[#4a5565]">Status (Required):</span> Select the appropriate status for the Test Case.</p>
            <p><span className="font-medium text-[#4a5565]">Note:</span> Only Test Cases in ready state will be available for execution.</p>
          </div>
        </div>

        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-[#f0f1f3] pt-4">
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" className={cqaBtnPrimary} disabled={readOnly || pending === "sg"}>
            {pending === "sg" ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
