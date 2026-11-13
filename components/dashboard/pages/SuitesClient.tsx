"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CreateCollectionButton } from "@/components/dashboard/pages/CreateCollectionButton";
import { AzureDevOpsSyncButton } from "@/components/dashboard/pages/AzureDevOpsSyncButton";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaInput, cqaLabel, useAction } from "@/components/dashboard/ui";
import { RowMenu } from "@/components/contextqa/row-menu";
import { BulkButton, ColumnFilter, ColumnSort, DataToolbar, SelectAllCheckbox, SelectionBar, TablePagination, distinctColumnValues, matchesColumnFilters, nextTableSort, sortTableRows, tableCardClass, type TableSortState } from "@/components/contextqa/table-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface SuiteRow {
  id: string;
  name: string;
  platform: string;
  module: string;
  testCasesCount: number;
  labelsJson: string;
  lastRunAt: string | null;
  passRate: number;
  createdAt: string;
}

const COLUMNS = [
  { key: "name", label: "Suite Name" },
  { key: "platform", label: "Platform" },
  { key: "cases", label: "Test Cases" },
  { key: "result", label: "Latest Result" },
  { key: "created", label: "Created Date" },
  { key: "modified", label: "Modified" },
  { key: "folder", label: "Folder" },
];

function liveResult(suite: { lastRunAt: string | null; passRate: number }) {
  if (!suite.lastRunAt) return "Not Executed";
  return suite.passRate >= 99 ? "Passed" : "Failed";
}

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function resultIcon(result: string) {
  return result === "Passed" ? "check_circle" : result === "Failed" ? "cancel" : "error_outline";
}

export function SuitesClient({
  suites,
  readOnly,
  defaultEmail,
}: {
  suites: SuiteRow[];
  readOnly: boolean;
  defaultEmail: string;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [isRefreshing, startRefresh] = useTransition();
  const [view, setView] = useState<"list" | "modular">("list");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(COLUMNS.map((column) => [column.key, true])));
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [localRows, setLocalRows] = useState(suites);
  const [sort, setSort] = useState<TableSortState>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuiteRow | null>(null);
  const [editTarget, setEditTarget] = useState<SuiteRow | null>(null);

  useEffect(() => setLocalRows(suites), [suites]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rowsFiltered = localRows.filter((suite) => {
      if (q && ![suite.name, suite.module, suite.platform].some((value) => value.toLowerCase().includes(q))) return false;
      if (filters.platform && suite.platform !== filters.platform) return false;
      if (filters.module && (suite.module || "Unorganised") !== filters.module) return false;
      if (filters.result && liveResult(suite) !== filters.result) return false;
      if (
        !matchesColumnFilters(columnFilters, {
          "Suite Name": suite.name,
          Platform: suite.platform,
          "Test Cases": suite.testCasesCount,
          "Latest Result": liveResult(suite),
          "Created Date": formatDate(suite.createdAt),
          Modified: formatDate(suite.lastRunAt ?? suite.createdAt),
          Folder: suite.module || "Unorganised",
        })
      ) {
        return false;
      }
      return true;
    });
    return sortTableRows(rowsFiltered, sort, {
      "Suite Name": (suite) => suite.name,
      Platform: (suite) => suite.platform,
      "Test Cases": (suite) => suite.testCasesCount,
      "Latest Result": (suite) => liveResult(suite),
      "Created Date": (suite) => suite.createdAt,
      Modified: (suite) => suite.lastRunAt ?? suite.createdAt,
      Folder: (suite) => suite.module || "Unorganised",
    });
  }, [localRows, search, filters, columnFilters, sort]);
  const sortColumn = (column: string) => {
    setSort((current) => nextTableSort(current, column));
    setPage(1);
  };

  const columnOptions = useMemo(
    () => ({
      Platform: distinctColumnValues(localRows.map((suite) => suite.platform)),
      "Latest Result": distinctColumnValues(localRows.map((suite) => liveResult(suite))),
      Folder: distinctColumnValues(localRows.map((suite) => suite.module || "Unorganised")),
    }),
    [localRows],
  );

  function setColumnFilter(column: string, value: string) {
    setColumnFilters((current) => ({ ...current, [column]: value }));
    setPage(1);
  }

  const folders = useMemo(() => {
    const map = new Map<string, SuiteRow[]>();
    for (const suite of filtered) {
      const key = suite.module.trim() || "Unorganised";
      map.set(key, [...(map.get(key) ?? []), suite]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allSelected = pageRows.length > 0 && pageRows.every((row) => selected.has(row.id));
  const someSelected = pageRows.some((row) => selected.has(row.id));

  function toggleAll(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const row of pageRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setVisibleColumns(next: Record<string, boolean>) {
    setVisible(next);
    window.localStorage.setItem("qasyn.suites.columns", JSON.stringify(next));
  }

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function runSuite(suite: SuiteRow) {
    const result = await run<{ passed: number; failed: number; total: number }>("run", `/api/dashboard/collections/suites/${suite.id}`, {
      method: "PATCH",
      json: { action: "run" },
    });
    if (result) {
      setLocalRows((current) =>
        current.map((row) =>
          row.id === suite.id
            ? { ...row, lastRunAt: new Date().toISOString(), passRate: result.total ? Math.round((result.passed / result.total) * 1000) / 10 : 0 }
            : row,
        ),
      );
      toast(`Suite "${suite.name}" ran · ${result.passed}/${result.total} passed.`, result.failed ? "info" : "success");
      router.refresh();
    }
  }

  async function cloneSuite(suite: SuiteRow) {
    const res = await run("clone", `/api/dashboard/collections/suites/${suite.id}`, {
      method: "PATCH",
      json: { action: "clone" },
      success: `Suite "${suite.name}" cloned.`,
    });
    if (res) router.refresh();
  }

  async function removeSuite(suite: SuiteRow) {
    const res = await apiFetch<{ ok: boolean }>(`/api/dashboard/collections/suites/${suite.id}`, { method: "DELETE" });
    if (res?.ok) {
      setLocalRows((current) => current.filter((row) => row.id !== suite.id));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(suite.id);
        return next;
      });
      toast(`Suite "${suite.name}" deleted.`, "success");
      router.refresh();
    }
    setDeleteTarget(null);
  }

  async function runSelected() {
    if (selected.size === 0) return;
    const targets = localRows.filter((row) => selected.has(row.id));
    let passed = 0;
    let failed = 0;
    try {
      for (const target of targets) {
        const result = await apiFetch<{ passed: number; failed: number }>(`/api/dashboard/collections/suites/${target.id}`, {
          method: "PATCH",
          json: { action: "run" },
        });
        passed += result?.passed ?? 0;
        failed += result?.failed ?? 0;
      }
      toast(`Ran ${targets.length} suites · ${passed} passed · ${failed} failed.`, failed ? "info" : "success");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const targets = localRows.filter((row) => selected.has(row.id));
    try {
      await Promise.all(targets.map((target) => apiFetch(`/api/dashboard/collections/suites/${target.id}`, { method: "DELETE" })));
      const ids = new Set(targets.map((target) => target.id));
      setLocalRows((current) => current.filter((row) => !ids.has(row.id)));
      setSelected(new Set());
      toast(`${targets.length} suite${targets.length === 1 ? "" : "s"} deleted.`, "success");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  function exportSelected() {
    const targets = localRows.filter((row) => selected.has(row.id));
    exportRows(targets);
  }

  function exportRows(targets: SuiteRow[]) {
    const lines = [
      ["Name", "Platform", "Module", "Test Cases", "Latest Result", "Pass Rate", "Created Date", "Last Run"].join(","),
      ...targets.map((row) =>
        [row.name, row.platform, row.module, row.testCasesCount, liveResult(row), `${row.passRate}%`, formatDate(row.createdAt), row.lastRunAt ? formatDate(row.lastRunAt) : "Never"]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "suites-report.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast(`${targets.length} suite${targets.length === 1 ? "" : "s"} exported.`, "success");
  }

  return (
    <div className="space-y-3">
      <DataToolbar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search suites"
        filters={[
          { key: "platform", label: "Platform", options: ["Web", "Mobile", "API"] },
          { key: "module", label: "Folder", options: [...new Set(localRows.map((row) => row.module || "Unorganised"))] },
          { key: "result", label: "Latest Result", options: ["Passed", "Failed", "Not Executed"] },
        ]}
        activeFilters={filters}
        onFiltersChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        columns={COLUMNS}
        visibleColumns={visible}
        onVisibleColumnsChange={setVisibleColumns}
        onRefresh={refresh}
        refreshing={isRefreshing}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white p-0.5 text-[12.5px]">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1", view === "list" ? "bg-[#f3f4f6] font-medium text-[#111827]" : "text-[#6b7280] hover:bg-[#f9fafb]")}
              >
                <CqaIcon name="view_list" className="text-[16px]" /> List
              </button>
              <button
                type="button"
                onClick={() => setView("modular")}
                className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1", view === "modular" ? "bg-[#f3f4f6] font-medium text-[#111827]" : "text-[#6b7280] hover:bg-[#f9fafb]")}
              >
                <CqaIcon name="folder" className="text-[16px]" /> Modular
              </button>
            </div>
            <AzureDevOpsSyncButton />
            <CreateCollectionButton kind="suites" readOnly={readOnly} label="Create Test Suite" defaultEmail={defaultEmail} />
          </>
        }
      />

      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkButton icon="play_arrow" disabled={readOnly || pending !== null} onClick={() => void runSelected()}>
          Run selected
        </BulkButton>
        <BulkButton icon="upload" onClick={exportSelected}>
          Export report
        </BulkButton>
        <BulkButton icon="delete" danger disabled={readOnly || pending !== null} onClick={() => void deleteSelected()}>
          Delete selected
        </BulkButton>
      </SelectionBar>

      {view === "modular" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {folders.length === 0 && (
            <div className={cn(cqaCard, "col-span-full px-5 py-14 text-center")}>
              <p className="text-[14px] font-medium text-[#374151]">No data available</p>
              <p className="mt-1 text-[12.5px] text-[#9ca3af]">Create a suite to group test cases that run together.</p>
            </div>
          )}
          {folders.map(([folder, rows]) => (
            <div key={folder} className={tableCardClass()}>
              <button
                type="button"
                onClick={() => setOpenFolder((prev) => (prev === folder ? null : folder))}
                className="flex w-full items-center gap-2 border-b border-[#f0f1f3] px-4 py-3 text-left"
              >
                <CqaIcon name="folder" className="text-[18px] text-[#5b4ee8]" />
                <span className="flex-1 text-[13px] font-semibold text-[#111827]">{folder}</span>
                <span className="text-[11.5px] text-[#6b7280]">{rows.length} suites</span>
                <CqaIcon name={openFolder === folder ? "expand_less" : "expand_more"} className="text-[18px] text-[#9ca3af]" />
              </button>
              {openFolder === folder && (
                <ul className="divide-y divide-[#f3f4f6]">
                  {rows.map((suite) => (
                    <li key={suite.id} className="flex items-center gap-2 px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <Link href={`/dashboard/plans/suites/${suite.id}`} className="block truncate text-[12.5px] font-medium text-[#1f2937] hover:text-[#5b4ee8]">
                          {suite.name}
                        </Link>
                        <span className="mt-0.5 block text-[11px] text-[#9ca3af]">{suite.testCasesCount} cases · {suite.platform}</span>
                      </span>
                      <span className="text-[11.5px] text-[#6b7280]">{liveResult(suite)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={tableCardClass()}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f1f3]">
                  <th className="w-9 px-4 py-3">
                    <SelectAllCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} label="Select all suites" />
                  </th>
                  <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Suite Name<ColumnFilter column="Suite Name" value={columnFilters["Suite Name"] ?? ""} onChange={(value) => setColumnFilter("Suite Name", value)} /><ColumnSort column="Suite Name" sort={sort} onSort={sortColumn} /></th>
                  {visible.platform && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Platform<ColumnFilter column="Platform" value={columnFilters.Platform ?? ""} onChange={(value) => setColumnFilter("Platform", value)} options={columnOptions.Platform} /><ColumnSort column="Platform" sort={sort} onSort={sortColumn} /></th>}
                  {visible.cases && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Test Cases<ColumnFilter column="Test Cases" value={columnFilters["Test Cases"] ?? ""} onChange={(value) => setColumnFilter("Test Cases", value)} /><ColumnSort column="Test Cases" sort={sort} onSort={sortColumn} /></th>}
                  {visible.result && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Latest Result<ColumnFilter column="Latest Result" value={columnFilters["Latest Result"] ?? ""} onChange={(value) => setColumnFilter("Latest Result", value)} options={columnOptions["Latest Result"]} /><ColumnSort column="Latest Result" sort={sort} onSort={sortColumn} /></th>}
                  {visible.created && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Created Date<ColumnFilter column="Created Date" value={columnFilters["Created Date"] ?? ""} onChange={(value) => setColumnFilter("Created Date", value)} /><ColumnSort column="Created Date" sort={sort} onSort={sortColumn} /></th>}
                  {visible.modified && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Modified<ColumnFilter column="Modified" value={columnFilters.Modified ?? ""} onChange={(value) => setColumnFilter("Modified", value)} /><ColumnSort column="Modified" sort={sort} onSort={sortColumn} /></th>}
                  {visible.folder && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Folder<ColumnFilter column="Folder" value={columnFilters.Folder ?? ""} onChange={(value) => setColumnFilter("Folder", value)} options={columnOptions.Folder} /><ColumnSort column="Folder" sort={sort} onSort={sortColumn} /></th>}
                  <th className="w-[72px] px-4 py-3 text-[12px] font-medium text-[#6b7280]">Action<ColumnSort column="Action" sort={sort} onSort={sortColumn} /></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center">
                      <p className="text-[14px] font-medium text-[#374151]">No test suites yet</p>
                      <p className="mt-1 text-[12.5px] text-[#9ca3af]">Create a suite to group test cases that run together.</p>
                    </td>
                  </tr>
                )}
                {pageRows.map((suite, index) => {
                  const result = liveResult(suite);
                  return (
                    <tr key={suite.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${suite.name}`}
                          checked={selected.has(suite.id)}
                          onChange={() => toggleOne(suite.id)}
                          className="size-3.5 accent-[#5b4ee8]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 text-[10px] font-medium text-[#9ca3af]">TS-{filtered.length - ((currentPage - 1) * pageSize + index)}</span>
                          <Link href={`/dashboard/plans/suites/${suite.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">
                            {suite.name}
                          </Link>
                        </div>
                      </td>
                      {visible.platform && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-[#4b5563]">
                            <CqaIcon
                              name={suite.platform === "Mobile" ? "smartphone" : suite.platform === "API" ? "api" : "desktop_windows"}
                              className="text-[15px] text-[#6b7280]"
                            />
                            {suite.platform}
                          </span>
                        </td>
                      )}
                      {visible.cases && <td className="px-4 py-3 font-medium text-[#374151]">{suite.testCasesCount}</td>}
                      {visible.result && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#4b5563]">
                            <CqaIcon name={resultIcon(result)} className="text-[16px]" />
                            {result}
                          </span>
                        </td>
                      )}
                      {visible.created && <td className="whitespace-nowrap px-4 py-3 text-[#6b7280]">{formatDate(suite.createdAt)}</td>}
                      {visible.modified && <td className="whitespace-nowrap px-4 py-3 text-[#6b7280]">{formatDate(suite.lastRunAt ?? suite.createdAt)}</td>}
                      {visible.folder && <td className="px-4 py-3 text-[#6b7280]">{suite.module || "Unorganised"}</td>}
                      <td className="px-4 py-3">
                        <RowMenu
                          label={`Actions for ${suite.name}`}
                          items={[
                            { label: "Open Suite", icon: "visibility", href: `/dashboard/plans/suites/${suite.id}` },
                            { label: "Run Suite", icon: "play_arrow", disabled: readOnly, onSelect: () => runSuite(suite) },
                            { label: "Clone", icon: "content_copy", disabled: readOnly, onSelect: () => cloneSuite(suite) },
                            { label: "Edit", icon: "edit", disabled: readOnly, onSelect: () => setEditTarget(suite) },
                            { label: "Export Report", icon: "download", onSelect: () => exportRows([suite]) },
                            { label: "Delete", icon: "delete", danger: true, disabled: readOnly, onSelect: () => setDeleteTarget(suite) },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination page={currentPage} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
        </div>
      )}

      <SuiteEditModal
        suite={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          router.refresh();
        }}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete suite"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg bg-[#dc2626] px-3 text-[13px] font-medium text-white hover:bg-[#b91c1c]"
              onClick={() => deleteTarget && void removeSuite(deleteTarget)}
            >
              Delete suite
            </button>
          </>
        }
      >
        <p className="text-[13px] text-[#4b5563]">
          Delete <strong>{deleteTarget?.name}</strong>? The suite is removed from SQLite. Test cases stay in the library.
        </p>
      </Modal>
    </div>
  );
}

function SuiteEditModal({ suite, onClose, onSaved }: { suite: SuiteRow | null; onClose: () => void; onSaved: () => void }) {
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [module, setModule] = useState("");
  const [platform, setPlatform] = useState("Web");

  useEffect(() => {
    if (!suite) return;
    setName(suite.name);
    setModule(suite.module);
    setPlatform(suite.platform);
    setError(null);
  }, [suite, setError]);

  if (!suite) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!suite) return;
    const res = await run("suite-edit", `/api/dashboard/collections/suites/${suite.id}`, {
      method: "PATCH",
      json: { action: "update", name, module, platform },
      success: `Suite "${name}" saved.`,
    });
    if (res) onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Edit suite" footer={
      <>
        <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" form="suite-edit-form" className={cqaBtnPrimary} disabled={pending === "suite-edit"}>
          {pending === "suite-edit" ? "Saving…" : "Save changes"}
        </button>
      </>
    }>
      <form id="suite-edit-form" onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className={cqaLabel}>Name *</span>
          <input className={cqaInput} value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={160} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={cqaLabel}>Folder / Module</span>
            <input className={cqaInput} value={module} onChange={(event) => setModule(event.target.value)} placeholder="Unorganised" />
          </label>
          <label className="block">
            <span className={cqaLabel}>Platform</span>
            <select className={cqaInput} value={platform} onChange={(event) => setPlatform(event.target.value)}>
              {["Web", "Mobile", "API"].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
