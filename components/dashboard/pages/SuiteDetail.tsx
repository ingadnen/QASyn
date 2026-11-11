"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CqaIcon, Modal, StatusPill, cqaBtnGhost, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaIconBtn, useAction } from "@/components/dashboard/ui";
import { RowMenu } from "@/components/contextqa/workspace";
import { ColumnFilter, matchesColumnFilters } from "@/components/contextqa/table-ui";
import { cn } from "@/lib/utils";

export interface SuiteCaseRow {
  id: string;
  code: string;
  title: string;
  status: string;
  module: string;
  lastRunAt: string | null;
}
export interface SuitePlanRow {
  id: string;
  code: string;
  name: string;
  platform: string;
  passRate: number;
  lastRunAt: string | null;
}
export interface SuiteDetailData {
  id: string;
  code: string;
  name: string;
  description: string;
  schedule: string;
  module: string;
  platform: string;
  labels: string[];
  prerequisites: string[];
  passRate: number;
  lastRunAt: string | null;
  createdAt: string;
}

interface Props {
  suite: SuiteDetailData;
  cases: SuiteCaseRow[];
  plans: SuitePlanRow[];
  allCases: Array<{ id: string; code: string; title: string; module: string }>;
  readOnly: boolean;
}

const TABS = ["cases", "plans", "history", "settings"] as const;
type Tab = (typeof TABS)[number];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function latestResult(caseRow: SuiteCaseRow): { label: string; tone: string; icon: string } {
  if (!caseRow.lastRunAt) return { label: "Not Executed", tone: "text-[#9ca3af]", icon: "error_outline" };
  if (caseRow.status === "passing") return { label: "Passed", tone: "text-[#00a63e]", icon: "task_alt" };
  if (caseRow.status === "failing") return { label: "Failed", tone: "text-[#dc2626]", icon: "highlight_off" };
  if (caseRow.status === "flaky") return { label: "Flaky", tone: "text-[#d97706]", icon: "warning" };
  return { label: "Not Executed", tone: "text-[#9ca3af]", icon: "error_outline" };
}

function caseStatusLabel(status: string) {
  if (status === "passing") return "Ready";
  if (status === "failing") return "In Review";
  if (status === "flaky") return "Ready";
  return "Draft";
}

function resultFor(plan: SuitePlanRow) {
  if (!plan.lastRunAt) return { label: "Not Executed", icon: "error_outline", tone: "text-[#9ca3af]" };
  return plan.passRate >= 99
    ? { label: "Passed", icon: "task_alt", tone: "text-[#00a63e]" }
    : { label: "Failed", icon: "highlight_off", tone: "text-[#dc2626]" };
}

const inputCls =
  "h-[41px] w-full rounded-md border border-[#d1d5db] bg-white px-3 text-[14px] text-[#0a0a0a] outline-none transition placeholder:text-[#9ca3af] focus:border-[#8b80ff] focus:ring-2 focus:ring-[#e4e1fd] disabled:bg-[#f9fafb] disabled:text-[#6b7280]";
const labelCls = "mb-2 block text-[14px] font-medium text-[#374151]";

export function SuiteDetail({ suite, cases, plans, allCases, readOnly }: Props) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [tab, setTab] = useState<Tab>("cases");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [caseColumnFilters, setCaseColumnFilters] = useState<Record<string, string>>({});
  const [planColumnFilters, setPlanColumnFilters] = useState<Record<string, string>>({});
  const [manageOpen, setManageOpen] = useState(false);
  const [manageQuery, setManageQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(cases.map((c) => c.id));

  const [name, setName] = useState(suite.name);
  const [description, setDescription] = useState(suite.description);
  const [folder, setFolder] = useState(suite.module);
  const [platform, setPlatform] = useState(suite.platform);
  const [labels, setLabels] = useState<string[]>(suite.labels);
  const [labelDraft, setLabelDraft] = useState("");
  const [prerequisite, setPrerequisite] = useState(suite.prerequisites[0] ?? "");
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const visibleCases = useMemo(() => {
    const filtered = cases.filter(
      (c) =>
        (status === "All" || caseStatusLabel(c.status) === status) &&
        (!query.trim() || `${c.code} ${c.title} ${c.module}`.toLowerCase().includes(query.trim().toLowerCase())) &&
        matchesColumnFilters(caseColumnFilters, {
          "Test Case": `${c.code} ${c.title}`,
          "Latest Result": latestResult(c).label,
          Status: caseStatusLabel(c.status),
          Folder: c.module || "Unorganised",
          "Last Executed": fmtDate(c.lastRunAt),
        }),
    );
    return reorder ? [...filtered].sort((a, b) => a.title.localeCompare(b.title)) : filtered;
  }, [cases, status, query, reorder, caseColumnFilters]);

  const visiblePlans = useMemo(
    () =>
      plans.filter((p) =>
        matchesColumnFilters(planColumnFilters, {
          "Test Plan": `${p.code} ${p.name}`,
          Platform: p.platform,
          "Latest Result": resultFor(p).label,
          "Last Executed": fmtDate(p.lastRunAt),
        }),
      ),
    [plans, planColumnFilters],
  );

  const pages = Math.max(1, Math.ceil(visibleCases.length / size));
  const current = Math.min(page, pages);
  const pageRows = visibleCases.slice((current - 1) * size, current * size);
  const from = visibleCases.length === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(current * size, visibleCases.length);

  const manageRows = useMemo(
    () => allCases.filter((c) => !manageQuery.trim() || `${c.code} ${c.title} ${c.module}`.toLowerCase().includes(manageQuery.trim().toLowerCase())),
    [allCases, manageQuery],
  );

  const result = suite.lastRunAt
    ? suite.passRate >= 99
      ? { label: "Passed", icon: "task_alt", tone: "text-[#00a63e]" }
      : { label: "Failed", icon: "highlight_off", tone: "text-[#dc2626]" }
    : { label: "Not Executed", icon: "error_outline", tone: "text-[#9ca3af]" };

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(suite.code);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function cloneSuite() {
    const res = await run<{ item: { id: string } }>("clone", "/api/dashboard/collections/suites", {
      json: { name: `${suite.name} (copy)`, description: suite.description, schedule: suite.schedule, module: suite.module },
    });
    if (res?.item) router.push(`/dashboard/plans/suites/${res.item.id}`);
  }

  async function saveSettings() {
    setSaved(false);
    const res = await run("save", `/api/dashboard/collections/suites/${suite.id}`, {
      method: "PATCH",
      json: { action: "update", name: name.trim(), description, module: folder, platform, labels, prerequisites: prerequisite ? [prerequisite] : [] },
    });
    if (res) {
      setSaved(true);
      router.refresh();
    }
  }

  async function deleteSuite() {
    if (!window.confirm(`Delete “${suite.name}”? Test cases in the library are not affected.`)) return;
    setDeleting(true);
    const res = await run("delete", `/api/dashboard/collections/suites/${suite.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res) router.push("/dashboard/plans/suites");
  }

  async function saveManagedCases() {
    const res = await run("link", `/api/dashboard/collections/suites/${suite.id}`, { method: "PATCH", json: { action: "link", testCaseIds: selected } });
    if (res) {
      setManageOpen(false);
      router.refresh();
    }
  }

  function toggleManaged(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  function addLabel() {
    const value = labelDraft.trim();
    if (!value || labels.includes(value)) return;
    setLabels((prev) => [...prev, value]);
    setLabelDraft("");
  }

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start gap-3">
        <Link href="/dashboard/plans/suites" aria-label="Back to test suites" className="mt-0.5 flex size-8 items-center justify-center rounded-md text-[#4a5565] hover:bg-[#f3f4f6]">
          <CqaIcon name="arrow_back" className="text-[20px]" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-bold leading-7 text-[#101828]">{suite.name}</h1>
            <span className="rounded border border-[#e5e7eb] bg-[#f9fafb] px-2 py-[2px] text-[11.5px] font-medium text-[#4a5565]">{suite.code}</span>
            <button type="button" onClick={copyCode} aria-label="Copy suite ID" className="text-[#9ca3af] hover:text-[#374151]">
              <CqaIcon name="content_copy" className="text-[16px]" />
            </button>
            <button type="button" onClick={() => void cloneSuite()} disabled={readOnly || pending === "clone"} className={cn(cqaBtnSecondary, "ml-1 h-8 px-3 text-[12.5px]")}>
              <CqaIcon name="content_copy" className="text-[15px]" /> Clone
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[#4a5565]">
            <span><strong className="font-semibold text-[#111827]">{cases.length}</strong> cases</span>
            <span className="inline-flex items-center gap-1"><CqaIcon name="desktop_windows" className="text-[16px] text-[#6b7280]" /> {suite.platform}</span>
            <span>{suite.module || "Unorganised"}</span>
            <span className="inline-flex items-center gap-1.5"><CqaIcon name="history" className="text-[15px] text-[#6b7280]" /> Latest result:</span>
            <span className={cn("inline-flex items-center gap-1 font-medium", result.tone)}><CqaIcon name={result.icon} className="text-[16px]" /> {result.label}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-6 overflow-x-auto border-b border-[#e5e7eb]">
        {[
          { id: "cases" as const, label: `Test Cases (${cases.length})` },
          { id: "plans" as const, label: `Used in Test Plans (${plans.length})` },
          { id: "history" as const, label: "History" },
          { id: "settings" as const, label: "Settings" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[13.5px] transition",
              tab === t.id ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280] hover:text-[#111827]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 text-[12.5px] text-red-600">{error}</p>}

      {tab === "cases" && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search"
                aria-label="Search test cases"
                className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
              />
            </div>
            <button type="button" onClick={() => setReorder((v) => !v)} aria-pressed={reorder} className={cn(cqaBtnGhost, "h-9 border bg-white px-2.5", reorder ? "border-[#a9a1f7] text-[#5b4ee8]" : "border-[#e5e7eb]")}>
              <CqaIcon name="swap_vert" className="text-[17px]" /> Reorder
            </button>
            <button type="button" onClick={() => setManageOpen(true)} disabled={readOnly} className={cn(cqaBtnGhost, "h-9 border border-[#e5e7eb] bg-white px-2.5")}>
              <CqaIcon name="add" className="text-[17px]" /> Add
            </button>
            {filterOpen && (
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2 text-[13px] text-[#374151] outline-none"
              >
                {["All", "Ready", "In Review", "Draft"].map((s) => <option key={s}>{s}</option>)}
              </select>
            )}
            <button type="button" aria-label="Filter" aria-pressed={filterOpen} onClick={() => setFilterOpen((v) => !v)} className={cn(cqaIconBtn, "size-9 border bg-white", filterOpen ? "border-[#a9a1f7] text-[#5b4ee8]" : "border-[#e5e7eb]")}>
              <CqaIcon name="filter_alt" className="text-[18px]" />
            </button>
            <button type="button" aria-label="Refresh" onClick={() => router.refresh()} className={cn(cqaIconBtn, "size-9 border border-[#e5e7eb] bg-white")}>
              <CqaIcon name="refresh" className="text-[18px]" />
            </button>
            <button type="button" onClick={() => setManageOpen(true)} disabled={readOnly} className={cn(cqaBtnSecondary, "h-9 px-2.5")}>
              <CqaIcon name="edit" className="text-[16px]" /> Manage Test Cases
            </button>
          </div>

          <div className={cn(cqaCard, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#f0f1f3] bg-white">
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Test Case<ColumnFilter column="Test Case" value={caseColumnFilters["Test Case"] ?? ""} onChange={(value) => setCaseColumnFilters((current) => ({ ...current, "Test Case": value }))} /></th>
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Latest Result<ColumnFilter column="Latest Result" value={caseColumnFilters["Latest Result"] ?? ""} onChange={(value) => setCaseColumnFilters((current) => ({ ...current, "Latest Result": value }))} options={["Passed", "Failed", "Flaky", "Not Executed"]} /></th>
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Status<ColumnFilter column="Status" value={caseColumnFilters.Status ?? ""} onChange={(value) => setCaseColumnFilters((current) => ({ ...current, Status: value }))} options={["Ready", "In Review", "Draft"]} /></th>
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Folder<ColumnFilter column="Folder" value={caseColumnFilters.Folder ?? ""} onChange={(value) => setCaseColumnFilters((current) => ({ ...current, Folder: value }))} /></th>
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Last Executed<ColumnFilter column="Last Executed" value={caseColumnFilters["Last Executed"] ?? ""} onChange={(value) => setCaseColumnFilters((current) => ({ ...current, "Last Executed": value }))} /></th>
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Action</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] text-[#374151]">
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-14 text-center">
                        <p className="text-[14px] font-medium text-[#374151]">No test cases in this suite</p>
                        <p className="mt-1 text-[12.5px] text-[#9ca3af]">Add test cases to start running this suite.</p>
                      </td>
                    </tr>
                  )}
                  {pageRows.map((c) => {
                    const r = latestResult(c);
                    return (
                      <tr key={c.id} className="border-b border-[#f3f4f6] bg-white last:border-0 hover:bg-[#fafafa]">
                        <td className="max-w-[520px] px-4 py-3">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 text-[10.5px] font-medium text-[#9ca3af]">{c.code}</span>
                            <Link href={`/dashboard/test-studio/${c.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{c.title}</Link>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1.5", r.tone)}><CqaIcon name={r.icon} className="text-[17px]" /> {r.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cn("rounded border px-2 py-[2px] text-[11.5px]", caseStatusLabel(c.status) === "Ready" ? "border-[#b9f8cf] bg-[#f0fdf4] text-[#00a63e]" : caseStatusLabel(c.status) === "In Review" ? "border-[#fde68a] bg-[#fffbeb] text-[#d97706]" : "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]")}>
                            {caseStatusLabel(c.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#4a5565]">{c.module || "Unorganised"}</td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[#6b7280]">{fmtDate(c.lastRunAt)}</td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <RowMenu
                            items={[
                              { label: "Open in Studio", icon: "open_in_new", href: `/dashboard/test-studio/${c.id}` },
                              { label: "View test case", icon: "visibility", href: `/dashboard/test-cases/${c.id}` },
                            ]}
                          />
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
                <select aria-label="Rows per page" className="h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">{from}–{to} of {visibleCases.length}</span>
                <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)} className="rounded p-1 hover:bg-[#f3f4f6] disabled:opacity-40"><CqaIcon name="chevron_left" className="text-[18px]" /></button>
                <button type="button" aria-label="Next page" disabled={current >= pages} onClick={() => setPage(current + 1)} className="rounded p-1 hover:bg-[#f3f4f6] disabled:opacity-40"><CqaIcon name="chevron_right" className="text-[18px]" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "plans" && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <button type="button" aria-label="Refresh" onClick={() => router.refresh()} className={cn(cqaIconBtn, "size-9 border border-[#e5e7eb] bg-white")}>
              <CqaIcon name="refresh" className="text-[18px]" />
            </button>
          </div>
          <div className={cn(cqaCard, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#f0f1f3] bg-white">
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Test Plan<ColumnFilter column="Test Plan" value={planColumnFilters["Test Plan"] ?? ""} onChange={(value) => setPlanColumnFilters((current) => ({ ...current, "Test Plan": value }))} /></th>
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Platform<ColumnFilter column="Platform" value={planColumnFilters.Platform ?? ""} onChange={(value) => setPlanColumnFilters((current) => ({ ...current, Platform: value }))} options={[...new Set(plans.map((p) => p.platform))]} /></th>
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Latest Result<ColumnFilter column="Latest Result" value={planColumnFilters["Latest Result"] ?? ""} onChange={(value) => setPlanColumnFilters((current) => ({ ...current, "Latest Result": value }))} options={["Passed", "Failed", "Not Executed"]} /></th>
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Last Executed<ColumnFilter column="Last Executed" value={planColumnFilters["Last Executed"] ?? ""} onChange={(value) => setPlanColumnFilters((current) => ({ ...current, "Last Executed": value }))} /></th>
                    <th className="whitespace-nowrap px-4 py-3 text-[12.5px] font-medium text-[#4a5565]">Action</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] text-[#374151]">
                  {visiblePlans.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-14 text-center">
                        <p className="text-[14px] font-medium text-[#374151]">Not used in any test plan</p>
                        <p className="mt-1 text-[12.5px] text-[#9ca3af]">Add this suite to a test plan to run it on a schedule or in CI.</p>
                      </td>
                    </tr>
                  )}
                  {visiblePlans.map((p) => {
                    const r = resultFor(p);
                    return (
                      <tr key={p.id} className="border-b border-[#f3f4f6] bg-white last:border-0 hover:bg-[#fafafa]">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 text-[10.5px] font-medium text-[#9ca3af]">{p.code}</span>
                            <Link href={`/dashboard/plans/test-plans/${p.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{p.name}</Link>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#4a5565]">{p.platform}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1.5", r.tone)}><CqaIcon name={r.icon} className="text-[17px]" /> {r.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[#6b7280]">{fmtDate(p.lastRunAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link href={`/dashboard/plans/test-plans/${p.id}`} className="font-medium text-[#5b4ee8] hover:underline">Open</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
              <span>Rows per page</span>
              <span className="tabular-nums">1–{plans.length} of {plans.length}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="mt-5">
          <p className="mb-3 text-[12.5px] font-medium text-[#6b7280]">1 Versions</p>
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div className={cn(cqaCard, "h-fit p-3")}>
              <button type="button" className="flex w-full items-start gap-2 rounded-md bg-[#f5f3ff] px-2.5 py-2.5 text-left">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#ddd6fe] bg-white text-[11.5px] font-semibold text-[#5b4ee8]">v1</span>
                <span>
                  <span className="block text-[13px] font-medium text-[#4f46e5]">Current</span>
                  <span className="mt-0.5 block text-[11.5px] text-[#6b7280]">{new Date(suite.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </span>
              </button>
              <p className="mt-2 px-1 text-[11.5px] text-[#6b7280]">Module organisation: {suite.module || "Unorganised"}</p>
            </div>

            <div className={cn(cqaCard, "p-5")}>
              <div className="flex items-start gap-3 border-b border-[#f0f1f3] pb-4">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#eef2ff] text-[13px] font-semibold text-[#4f46e5]">S</span>
                <div>
                  <p className="text-[14px] font-semibold text-[#111827]">Version 1 <span className="ml-2 rounded border border-[#b9f8cf] bg-[#f0fdf4] px-1.5 py-[1px] text-[10.5px] font-medium text-[#00a63e]">Current</span></p>
                  <p className="mt-0.5 text-[11.5px] text-[#6b7280]">System · {new Date(suite.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {new Date(suite.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                  <p className="mt-1 text-[12px] text-[#4a5565]">Module organisation: {suite.module || "Unorganised"}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-[#374151]">Test Suite Created <span className="rounded bg-[#f3f4f6] px-1.5 py-[1px] text-[11px] font-medium text-[#4a5565]">{cases.length}</span></p>
                <dl className="mt-3 grid gap-x-8 gap-y-4 text-[12.5px] sm:grid-cols-2">
                  {[
                    ["NAME", suite.name],
                    ["DESCRIPTION", suite.description || "Created automatically by module organisation"],
                    ["PLATFORM", suite.platform],
                    ["BROWSER", suite.platform === "Web" ? "Chromium" : "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">{k}</dt>
                      <dd className="mt-1 grid grid-cols-2 gap-2 text-[#374151]"><span className="text-[#9ca3af]">Before<br /><span className="text-[12px]">-</span></span><span>After<br /><span className="text-[12px]">{v}</span></span></dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-4 border-t border-[#f0f1f3] pt-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-[#374151]">Test Cases Added <span className="rounded bg-[#f3f4f6] px-1.5 py-[1px] text-[11px] font-medium text-[#4a5565]">{cases.length}</span></p>
                <ul className="mt-2 grid gap-1 text-[12.5px] text-[#4a5565] sm:grid-cols-2">
                  {cases.map((c) => (
                    <li key={c.id} className="flex items-center gap-2"><span className="rounded border border-[#b9f8cf] bg-[#f0fdf4] px-1.5 py-[1px] text-[10px] font-medium text-[#00a63e]">Added</span>{c.code}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="mt-5 max-w-4xl">
          <h2 className="text-[18px] font-semibold text-[#262626]">Suite Settings</h2>
          <p className="mt-1 text-[13.5px] text-[#6b7280]">Reusable suite configuration. Execution settings (browsers, environment, mode) are configured per Test Plan.</p>

          <div className={cn(cqaCard, "mt-4 p-[25px]")}>
            <div className="grid gap-5 lg:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Suite name <span className="text-[#ef4444]">*</span></span>
                <input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} disabled={readOnly} />
              </label>
              <label className="block">
                <span className={labelCls}>Prerequisite cases <CqaIcon name="info" className="ml-1 text-[14px] text-[#9ca3af]" /> <span className="font-normal text-[#6b7280]">(Optional)</span></span>
                <select className={inputCls} value={prerequisite} onChange={(e) => { setPrerequisite(e.target.value); setSaved(false); }} disabled={readOnly}>
                  <option value="">Select prerequisite test case</option>
                  {allCases.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Folder / location</span>
                <div className="relative">
                  <CqaIcon name="folder_open" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
                  <input className={cn(inputCls, "pl-9")} value={folder} onChange={(e) => { setFolder(e.target.value); setSaved(false); }} placeholder="Select a folder" disabled={readOnly} />
                </div>
              </label>
              <div>
                <span className={labelCls}>Target platform <CqaIcon name="info" className="ml-1 text-[14px] text-[#9ca3af]" /></span>
                <div className="grid grid-cols-3 gap-2">
                  {([["Web", "desktop_windows"], ["Mobile", "mobile_2"], ["API", "api"]] as const).map(([value, icon]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={readOnly}
                      onClick={() => { setPlatform(value); setSaved(false); }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2.5 text-[13.5px] transition",
                        platform === value ? "border-[#5b4ee8] bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "border-[#d1d5db] bg-white text-[#374151] hover:border-[#b9b1fb]",
                      )}
                    >
                      <CqaIcon name={icon} className="text-[18px]" /> {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-[#f0f1f3] pt-5">
              <p className="text-[13.5px] font-medium text-[#374151]">Current Labels ({labels.length})</p>
              <div className="mt-2 flex min-h-[41px] flex-wrap items-center gap-2 rounded-md border border-[#d1d5db] bg-white px-2 py-1.5">
                {labels.map((label) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-2 py-1 text-[12.5px] text-[#374151]">
                    {label}
                    <button type="button" aria-label={`Remove ${label}`} disabled={readOnly} onClick={() => { setLabels((prev) => prev.filter((v) => v !== label)); setSaved(false); }} className="text-[#9ca3af] hover:text-[#dc2626]">
                      <CqaIcon name="close" className="text-[13px]" />
                    </button>
                  </span>
                ))}
                <CqaIcon name="search" className="text-[16px] text-[#9ca3af]" />
                <input
                  value={labelDraft}
                  disabled={readOnly}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(); } }}
                  placeholder="Add a label"
                  className="h-7 min-w-[160px] flex-1 border-0 px-1 text-[13px] outline-none placeholder:text-[#9ca3af]"
                />
              </div>
            </div>

            <label className="mt-5 block">
              <span className={labelCls}>Description</span>
              <textarea className={cn(inputCls, "h-auto min-h-[86px] resize-y py-2.5")} value={description} onChange={(e) => { setDescription(e.target.value); setSaved(false); }} disabled={readOnly} />
            </label>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[#f0f1f3] pt-5">
              {saved && <span className="mr-auto text-[12.5px] font-medium text-[#00a63e]">Changes saved</span>}
              <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => { setName(suite.name); setDescription(suite.description); setFolder(suite.module); setPlatform(suite.platform); setLabels(suite.labels); setPrerequisite(suite.prerequisites[0] ?? ""); }}>Cancel</button>
              <button type="button" className={cqaBtnPrimary} disabled={readOnly || pending === "save" || !name.trim()} onClick={saveSettings}>{pending === "save" ? "Saving…" : "Save Changes"}</button>
            </div>
          </div>

          <div className={cn(cqaCard, "mt-6 border-[#fecaca] p-[25px]")}>
            <h3 className="text-[15px] font-semibold text-[#b91c1c]">Delete this suite</h3>
            <p className="mt-1 text-[13px] text-[#6b7280]">Permanently removes the suite. Test cases in the library are not affected.</p>
            <button type="button" onClick={() => void deleteSuite()} disabled={readOnly || deleting} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 text-[13px] font-medium text-[#dc2626] hover:bg-[#fee2e2] disabled:opacity-50">
              <CqaIcon name="delete" className="text-[16px]" /> {deleting ? "Deleting…" : "Delete Suite"}
            </button>
          </div>
        </div>
      )}

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage Test Cases"
        footer={
          <>
            <span className="mr-auto self-center text-[12.5px] text-[#6b7280]">{selected.length} selected</span>
            <button type="button" className={cqaBtnSecondary} onClick={() => setManageOpen(false)}>Cancel</button>
            <button type="button" className={cqaBtnPrimary} onClick={() => void saveManagedCases()} disabled={readOnly || pending === "link"}>
              {pending === "link" ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
            <input className="h-9 w-full rounded-lg border border-[#e5e7eb] pl-9 pr-3 text-[13px] outline-none focus:border-[#a9a1f7]" placeholder="Search test cases" value={manageQuery} onChange={(e) => setManageQuery(e.target.value)} />
          </div>
          <div className="max-h-[360px] divide-y divide-[#f0f1f3] overflow-y-auto rounded-lg border border-[#e5e7eb]">
            {manageRows.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 hover:bg-[#fafafa]">
                <input type="checkbox" className="mt-1 size-4 accent-[#5b4ee8]" checked={selected.includes(c.id)} onChange={() => toggleManaged(c.id)} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-[#1f2937]"><span className="text-[10.5px] text-[#9ca3af]">{c.code}</span>{c.title}</span>
                  <span className="mt-0.5 block text-[11.5px] text-[#6b7280]">{c.module || "Unorganised"}</span>
                </span>
              </label>
            ))}
            {manageRows.length === 0 && <p className="px-3 py-8 text-center text-[12.5px] text-[#9ca3af]">No test cases match.</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
