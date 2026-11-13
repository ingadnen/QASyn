"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal, StatusPill, cqaBtnSecondary, useAction } from "@/components/dashboard/ui";
import { LinkTests } from "@/components/dashboard/pages/LinkTests";
import { RowMenu } from "@/components/contextqa/row-menu";
import { BulkButton, ColumnFilter, ColumnSort, DataToolbar, SelectAllCheckbox, SelectionBar, TablePagination, distinctColumnValues, matchesColumnFilters, nextTableSort, sortTableRows, tableCardClass, type TableSortState } from "@/components/contextqa/table-ui";
import { AzureDevOpsSyncButton } from "@/components/dashboard/pages/AzureDevOpsSyncButton";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface RequirementRow {
  id: string;
  code: string;
  title: string;
  sourceLabel: string;
  isCrawl: boolean;
  coverageStatus: string;
  linked: number;
  linkedIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface RequirementTestCaseOption {
  id: string;
  title: string;
}

const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "format", label: "Format" },
  { key: "type", label: "Type" },
  { key: "plan", label: "Test Plan" },
  { key: "status", label: "Status" },
  { key: "cases", label: "Test Cases" },
  { key: "author", label: "Created by" },
  { key: "created", label: "Created Date" },
];

function libraryStatus(coverageStatus: string) {
  if (coverageStatus === "covered") return "Completed";
  if (coverageStatus === "partial") return "In Progress";
  return "Pending Action";
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

async function download(url: string, fileName: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export function RequirementsTable({
  rows,
  testCases,
  readOnly,
  actions,
}: {
  rows: RequirementRow[];
  testCases: RequirementTestCaseOption[];
  readOnly: boolean;
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [isRefreshing, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(COLUMNS.map((column) => [column.key, true])));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [localRows, setLocalRows] = useState(rows);
  const [deleteTarget, setDeleteTarget] = useState<RequirementRow | null>(null);
  const [linkTarget, setLinkTarget] = useState<RequirementRow | null>(null);
  const [sort, setSort] = useState<TableSortState>(null);

  useEffect(() => setLocalRows(rows), [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rowsFiltered = localRows.filter((row) => {
      if (query && ![row.title, row.code, row.sourceLabel, row.coverageStatus].some((value) => value.toLowerCase().includes(query))) return false;
      if (filters.status && libraryStatus(row.coverageStatus) !== filters.status) return false;
      if (filters.type && row.sourceLabel !== filters.type) return false;
      if (
        !matchesColumnFilters(columnFilters, {
          Name: row.title,
          Format: row.isCrawl ? "Auto Crawl" : row.sourceLabel,
          Type: row.isCrawl ? "Crawl" : row.sourceLabel,
          "Test Plan": "-",
          Status: libraryStatus(row.coverageStatus),
          "Test Cases": row.linked,
          "Created by": row.createdBy,
          "Created Date": formatDate(row.createdAt),
        })
      ) {
        return false;
      }
      return true;
    });
    return sortTableRows(rowsFiltered, sort, {
      Name: (row) => `${row.code} ${row.title}`,
      Format: (row) => (row.isCrawl ? "Auto Crawl" : row.sourceLabel),
      Type: (row) => (row.isCrawl ? "Crawl" : row.sourceLabel),
      "Test Plan": () => "-",
      Status: (row) => libraryStatus(row.coverageStatus),
      "Test Cases": (row) => row.linked,
      "Created by": (row) => row.createdBy,
      "Created Date": (row) => row.createdAt,
    });
  }, [localRows, search, filters, columnFilters, sort]);
  const sortColumn = (column: string) => {
    setSort((current) => nextTableSort(current, column));
    setPage(1);
  };

  const columnOptions = useMemo(
    () => ({
      Format: distinctColumnValues(localRows.map((row) => (row.isCrawl ? "Auto Crawl" : row.sourceLabel))),
      Type: distinctColumnValues(localRows.map((row) => (row.isCrawl ? "Crawl" : row.sourceLabel))),
      Status: distinctColumnValues(localRows.map((row) => libraryStatus(row.coverageStatus))),
      "Created by": distinctColumnValues(localRows.map((row) => row.createdBy)),
    }),
    [localRows],
  );

  function setColumnFilter(column: string, value: string) {
    setColumnFilters((current) => ({ ...current, [column]: value }));
    setPage(1);
  }

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
    window.localStorage.setItem("qasyn.requirements.columns", JSON.stringify(next));
  }

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function generate(row: RequirementRow) {
    const result = await run<{ created: number; linked: number }>("generate", `/api/dashboard/requirements/${row.id}`, {
      method: "PATCH",
      json: { action: "generate" },
    });
    if (result) {
      setLocalRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, linked: result.linked, coverageStatus: result.linked > 0 ? "covered" : entry.coverageStatus } : entry)));
      toast(`Generated ${result.created} test cases for ${row.code}.`, "success");
    }
  }

  async function reimport(row: RequirementRow) {
    const result = await run<{ created: number; linked: number }>("reimport", `/api/dashboard/requirements/${row.id}`, {
      method: "PATCH",
      json: { action: "reimport" },
    });
    if (result) {
      setLocalRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, linked: result.linked, coverageStatus: result.linked > 0 ? "covered" : entry.coverageStatus } : entry)));
      toast(`Requirement re-imported · ${result.created} test cases generated.`, "success");
    }
  }

  async function remove(row: RequirementRow) {
    const res = await apiFetch<{ ok: boolean }>(`/api/dashboard/requirements/${row.id}`, { method: "DELETE" });
    if (res?.ok) {
      setLocalRows((current) => current.filter((entry) => entry.id !== row.id));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      toast(`Requirement "${row.code}" deleted.`, "success");
      router.refresh();
    }
    setDeleteTarget(null);
  }

  async function removeSelected() {
    if (selected.size === 0) return;
    const targets = localRows.filter((row) => selected.has(row.id));
    try {
      await Promise.all(targets.map((row) => apiFetch(`/api/dashboard/requirements/${row.id}`, { method: "DELETE" })));
      const ids = new Set(targets.map((row) => row.id));
      setLocalRows((current) => current.filter((row) => !ids.has(row.id)));
      setSelected(new Set());
      toast(`${targets.length} requirement${targets.length === 1 ? "" : "s"} deleted.`, "success");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  function exportRows(targets: RequirementRow[]) {
    const lines = [
      ["Code", "Title", "Source", "Status", "Linked", "Created Date"].join(","),
      ...targets.map((row) => [row.code, row.title, row.sourceLabel, libraryStatus(row.coverageStatus), row.linked, formatDate(row.createdAt)].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "requirements.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast(`${targets.length} requirement${targets.length === 1 ? "" : "s"} exported.`, "success");
  }

  return (
    <div className="space-y-3">
      <DataToolbar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          { key: "status", label: "Status", options: ["Completed", "In Progress", "Pending Action"] },
          { key: "type", label: "Type", options: ["Crawl", "Manual", "Doc", "Jira", "Linear", "Import"] },
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
          <div className="flex items-center gap-2">
            {actions}
            <AzureDevOpsSyncButton />
          </div>
        }
      />

      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkButton icon="auto_awesome" disabled={readOnly || pending !== null} onClick={() => void Promise.all(localRows.filter((row) => selected.has(row.id)).map(generate))}>
          Run selected
        </BulkButton>
        <BulkButton icon="upload" onClick={() => exportRows(localRows.filter((row) => selected.has(row.id)))}>
          Export CSV
        </BulkButton>
        <BulkButton icon="delete" danger disabled={readOnly || pending !== null} onClick={() => void removeSelected()}>
          Delete selected
        </BulkButton>
      </SelectionBar>

      <div className={tableCardClass()}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#f0f1f3] bg-white">
                <th className="w-8 px-4 py-3">
                  <SelectAllCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} label="Select all requirements" />
                </th>
                {visible.name !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Name<ColumnFilter column="Name" value={columnFilters.Name ?? ""} onChange={(value) => setColumnFilter("Name", value)} /><ColumnSort column="Name" sort={sort} onSort={sortColumn} /></th>}
                {visible.format !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Format<ColumnFilter column="Format" value={columnFilters.Format ?? ""} onChange={(value) => setColumnFilter("Format", value)} options={columnOptions.Format} /><ColumnSort column="Format" sort={sort} onSort={sortColumn} /></th>}
                {visible.type !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Type<ColumnFilter column="Type" value={columnFilters.Type ?? ""} onChange={(value) => setColumnFilter("Type", value)} options={columnOptions.Type} /><ColumnSort column="Type" sort={sort} onSort={sortColumn} /></th>}
                {visible.plan !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Test Plan<ColumnFilter column="Test Plan" value={columnFilters["Test Plan"] ?? ""} onChange={(value) => setColumnFilter("Test Plan", value)} /><ColumnSort column="Test Plan" sort={sort} onSort={sortColumn} /></th>}
                {visible.status !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Status<ColumnFilter column="Status" value={columnFilters.Status ?? ""} onChange={(value) => setColumnFilter("Status", value)} options={columnOptions.Status} /><ColumnSort column="Status" sort={sort} onSort={sortColumn} /></th>}
                {visible.cases !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Test Cases<ColumnFilter column="Test Cases" value={columnFilters["Test Cases"] ?? ""} onChange={(value) => setColumnFilter("Test Cases", value)} /><ColumnSort column="Test Cases" sort={sort} onSort={sortColumn} /></th>}
                {visible.author !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Created by<ColumnFilter column="Created by" value={columnFilters["Created by"] ?? ""} onChange={(value) => setColumnFilter("Created by", value)} options={columnOptions["Created by"]} /><ColumnSort column="Created by" sort={sort} onSort={sortColumn} /></th>}
                {visible.created !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Created Date<ColumnFilter column="Created Date" value={columnFilters["Created Date"] ?? ""} onChange={(value) => setColumnFilter("Created Date", value)} /><ColumnSort column="Created Date" sort={sort} onSort={sortColumn} /></th>}
                <th className="sticky right-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-[12px] font-medium text-[#6b7280] shadow-[-6px_0_12px_-8px_rgba(15,23,42,0.12)]">Action<ColumnSort column="Action" sort={sort} onSort={sortColumn} /></th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-[#374151]">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.filter((column) => visible[column.key] !== false).length + 2} className="px-4 py-14 text-center">
                    <p className="text-[14px] font-medium text-[#374151]">No data available</p>
                    <p className="mt-1 text-[12.5px] text-[#9ca3af]">{localRows.length === 0 ? "Upload requirements or create one with New Requirement." : "No requirement matches the current search and filters."}</p>
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.id} className="bg-white transition hover:bg-[#fafafa]">
                  <td className="w-8 border-b border-[#f3f4f6] px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.code}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      className="size-3.5 rounded border-[#d1d5db] accent-[#5b4ee8]"
                    />
                  </td>
                  {visible.name !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3">
                      <p className="text-[10px] font-medium text-[#9ca3af]">{row.code}</p>
                      <Link href={`/dashboard/requirements/${row.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{row.title}</Link>
                    </td>
                  )}
                  {visible.format !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3">
                      <span className="inline-flex items-center rounded bg-[#f3f4f6] px-2 py-0.5 text-[11.5px] font-medium text-[#374151]">{row.isCrawl ? "Auto Crawl" : row.sourceLabel}</span>
                    </td>
                  )}
                  {visible.type !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[#4b5563]">
                        <span className="material-symbols-outlined text-[16px] text-[#6b7280]">{row.isCrawl ? "language" : "description"}</span>
                        {row.isCrawl ? "Crawl" : row.sourceLabel}
                      </span>
                    </td>
                  )}
                  {visible.plan !== false && <td className="border-b border-[#f3f4f6] px-4 py-3 text-[#4b5563]">-</td>}
                  {visible.status !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3"><StatusPill value={row.coverageStatus} label={libraryStatus(row.coverageStatus)} /></td>
                  )}
                  {visible.cases !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3">
                      <span className="font-semibold text-[#1f2937]">{row.linked}</span> <span className="text-[#6b7280]">Linked</span>
                    </td>
                  )}
                  {visible.author !== false && <td className="whitespace-nowrap border-b border-[#f3f4f6] px-4 py-3 text-[#4b5563]">{row.createdBy}</td>}
                  {visible.created !== false && <td className="whitespace-nowrap border-b border-[#f3f4f6] px-4 py-3 text-[#6b7280]">{formatDate(row.createdAt)}</td>}
                  <td className="sticky right-0 z-10 border-b border-[#f3f4f6] bg-white px-4 py-3 shadow-[-6px_0_12px_-8px_rgba(15,23,42,0.12)]">
                    <RowMenu
                      label={`Actions for ${row.code}`}
                      items={[
                        { label: "View Details", icon: "visibility", href: `/dashboard/requirements/${row.id}` },
                        { label: "Generate Test Cases", icon: "auto_awesome", disabled: readOnly, onSelect: () => generate(row) },
                        { label: "Link Existing Test Cases", icon: "link", disabled: readOnly, onSelect: () => setLinkTarget(row) },
                        {
                          label: "Download Original",
                          icon: "download",
                          onSelect: async () => {
                            try {
                              await download(`/api/dashboard/requirements/${row.id}/export?format=json`, `${row.code}-requirement.json`);
                              toast("Requirement downloaded.", "success");
                            } catch (error) {
                              toast(errorMessage(error), "error");
                            }
                          },
                        },
                        {
                          label: "Export Test Cases",
                          icon: "upload",
                          onSelect: async () => {
                            try {
                              await download(`/api/dashboard/requirements/${row.id}/export?format=csv`, `${row.code}-test-cases.csv`);
                              toast("Test cases exported to CSV.", "success");
                            } catch (error) {
                              toast(errorMessage(error), "error");
                            }
                          },
                        },
                        {
                          label: "Export Test Cases (JSON)",
                          icon: "data_object",
                          onSelect: async () => {
                            try {
                              await download(`/api/dashboard/requirements/${row.id}/export?format=json`, `${row.code}-test-cases.json`);
                              toast("Test cases exported to JSON.", "success");
                            } catch (error) {
                              toast(errorMessage(error), "error");
                            }
                          },
                        },
                        { label: "Re-import / Update", icon: "sync", disabled: readOnly, onSelect: () => reimport(row) },
                        { label: "Delete", icon: "delete", danger: true, disabled: readOnly, onSelect: () => setDeleteTarget(row) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={currentPage} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
      </div>

      <Modal open={Boolean(linkTarget)} onClose={() => setLinkTarget(null)} title={`Link test cases — ${linkTarget?.code ?? ""}`} size="lg">
        {linkTarget && (
          <>
            <p className="mb-2 text-[13px] text-[#4b5563]">{linkTarget.title}</p>
            {testCases.length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">No test cases exist yet. Generate some first.</p>
            ) : (
              <LinkTests
                itemId={linkTarget.id}
                testCases={testCases}
                linkedIds={linkTarget.linkedIds}
                readOnly={readOnly}
                onSaved={(count) => {
                  setLocalRows((current) => current.map((entry) => (entry.id === linkTarget.id ? { ...entry, linked: count, linkedIds: entry.linkedIds } : entry)));
                  setLinkTarget(null);
                  router.refresh();
                }}
              />
            )}
          </>
        )}
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete requirement" footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button type="button" className={cn("inline-flex h-9 items-center rounded-lg bg-[#dc2626] px-3 text-[13px] font-medium text-white hover:bg-[#b91c1c]")} onClick={() => deleteTarget && void remove(deleteTarget)}>
            Delete requirement
          </button>
        </>
      }>
        <p className="text-[13px] text-[#4b5563]">
          Delete <strong>{deleteTarget?.code} · {deleteTarget?.title}</strong>? It is removed from the requirements grid and SQLite. Linked test cases are preserved.
        </p>
      </Modal>
    </div>
  );
}
