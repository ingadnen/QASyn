"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal, StatusPill, cqaBtnSecondary, useAction } from "@/components/dashboard/ui";
import { RowMenu } from "@/components/contextqa/row-menu";
import { BulkButton, DataToolbar, SelectAllCheckbox, SelectionBar, TablePagination, tableCardClass } from "@/components/contextqa/table-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface CrawlRow {
  id: string;
  code: string;
  name: string;
  plan: string;
  status: string;
  cases: number;
  createdBy: string;
  createdAt: string;
  targetUrl: string;
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

function crawlStatus(status: string) {
  if (status === "running") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
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

function visibilityFromStorage() {
  return Object.fromEntries(COLUMNS.map((column) => [column.key, true]));
}

export function CrawlTable({ rows, readOnly, actions }: { rows: CrawlRow[]; readOnly: boolean; actions?: React.ReactNode }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [isRefreshing, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>(visibilityFromStorage);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<CrawlRow | null>(null);
  const [localRows, setLocalRows] = useState(rows);

  useEffect(() => setLocalRows(rows), [rows]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("qasyn.crawl.columns");
    if (stored) {
      try {
        setVisible({ ...visibilityFromStorage(), ...(JSON.parse(stored) as Record<string, boolean>) });
      } catch {
        /* ignore malformed preferences */
      }
    }
  }, []);

  function setVisibleColumns(next: Record<string, boolean>) {
    setVisible(next);
    window.localStorage.setItem("qasyn.crawl.columns", JSON.stringify(next));
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return localRows.filter((row) => {
      if (query && ![row.name, row.code, row.status, row.plan, row.createdBy, row.targetUrl].some((value) => value.toLowerCase().includes(query))) return false;
      if (filters.status && row.status !== filters.status) return false;
      if (filters.format && "Auto Crawl" !== filters.format) return false;
      return true;
    });
  }, [localRows, search, filters]);

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

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function complete(row: CrawlRow) {
    const res = await run<{ created: number }>("complete", `/api/dashboard/crawl/${row.id}`, { method: "PATCH", json: { action: "complete" } });
    if (res) toast(`Crawl completed · ${res.created ?? 0} test cases generated.`, "success");
  }

  async function reimport(row: CrawlRow) {
    const result = await run<{ created: number; updated: number }>("reimport", `/api/dashboard/crawl/${row.id}`, {
      method: "PATCH",
      json: { action: "reimport" },
    });
    if (result) toast(`Crawl re-imported · ${result.created ?? 0} created · ${result.updated ?? 0} refreshed.`, "success");
  }

  async function remove(row: CrawlRow) {
    const res = await apiFetch<{ ok: boolean }>(`/api/dashboard/crawl/${row.id}`, { method: "DELETE" });
    if (res?.ok) {
      setLocalRows((current) => current.filter((entry) => entry.id !== row.id));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      toast(`Crawl "${row.name}" deleted.`, "success");
      router.refresh();
    }
    setDeleteTarget(null);
  }

  async function removeSelected() {
    if (selected.size === 0) return;
    const targets = localRows.filter((row) => selected.has(row.id));
    try {
      await Promise.all(targets.map((row) => apiFetch(`/api/dashboard/crawl/${row.id}`, { method: "DELETE" })));
      const ids = new Set(targets.map((row) => row.id));
      setLocalRows((current) => current.filter((row) => !ids.has(row.id)));
      setSelected(new Set());
      toast(`${targets.length} crawl${targets.length === 1 ? "" : "s"} deleted.`, "success");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  function exportRows(targets: CrawlRow[]) {
    const lines = [
      ["Code", "Name", "Status", "Test Cases", "Created by", "Created Date"].join(","),
      ...targets.map((row) => [row.code, row.name, crawlStatus(row.status), row.cases, row.createdBy, formatDate(row.createdAt)].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "crawls.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast(`${targets.length} crawl${targets.length === 1 ? "" : "s"} exported.`, "success");
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
          { key: "status", label: "Status", options: ["running", "completed", "failed"] },
          { key: "format", label: "Format", options: ["Auto Crawl"] },
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
        actions={actions}
      />

      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkButton icon="play_arrow" disabled={readOnly || pending !== null} onClick={() => void Promise.all(localRows.filter((row) => selected.has(row.id) && row.status === "running").map(complete))}>
          Run selected
        </BulkButton>
        <BulkButton icon="sync" disabled={readOnly || pending !== null} onClick={() => void Promise.all(localRows.filter((row) => selected.has(row.id)).map(reimport))}>
          Re-import
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
                  <SelectAllCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} label="Select all crawls" />
                </th>
                {visible.name !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Name</th>}
                {visible.format !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Format</th>}
                {visible.type !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Type</th>}
                {visible.plan !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Test Plan</th>}
                {visible.status !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Status</th>}
                {visible.cases !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Test Cases</th>}
                {visible.author !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Created by</th>}
                {visible.created !== false && <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Created Date</th>}
                <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-[#374151]">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.filter((column) => visible[column.key] !== false).length + 2} className="px-4 py-14 text-center">
                    <p className="text-[14px] font-medium text-[#374151]">No data available</p>
                    <p className="mt-1 text-[12.5px] text-[#9ca3af]">{localRows.length === 0 ? "Start a crawl with New Crawl. Logs and flows appear here." : "No crawl matches the current search and filters."}</p>
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.id} className="bg-white transition hover:bg-[#fafafa]">
                  <td className="w-8 border-b border-[#f3f4f6] px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.name}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      className="size-3.5 rounded border-[#d1d5db] accent-[#5b4ee8]"
                    />
                  </td>
                  {visible.name !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3">
                      <p className="text-[10px] font-medium text-[#9ca3af]">{row.code}</p>
                      <Link href={`/dashboard/crawl/${row.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{row.name}</Link>
                    </td>
                  )}
                  {visible.format !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3">
                      <span className="inline-flex items-center rounded bg-[#f3f4f6] px-2 py-0.5 text-[11.5px] font-medium text-[#374151]">Auto Crawl</span>
                    </td>
                  )}
                  {visible.type !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[#4b5563]">
                        <span className="material-symbols-outlined text-[16px] text-[#6b7280]">language</span> Crawl
                      </span>
                    </td>
                  )}
                  {visible.plan !== false && <td className="max-w-[180px] truncate border-b border-[#f3f4f6] px-4 py-3 text-[#4b5563]">{row.plan}</td>}
                  {visible.status !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3"><StatusPill value={row.status} label={crawlStatus(row.status)} /></td>
                  )}
                  {visible.cases !== false && (
                    <td className="border-b border-[#f3f4f6] px-4 py-3">
                      <span className="font-semibold text-[#1f2937]">{row.cases}</span> <span className="text-[#6b7280]">Linked</span>
                    </td>
                  )}
                  {visible.author !== false && <td className="whitespace-nowrap border-b border-[#f3f4f6] px-4 py-3 text-[#4b5563]">{row.createdBy}</td>}
                  {visible.created !== false && <td className="whitespace-nowrap border-b border-[#f3f4f6] px-4 py-3 text-[#6b7280]">{formatDate(row.createdAt)}</td>}
                  <td className="border-b border-[#f3f4f6] px-4 py-3">
                    <RowMenu
                      label={`Actions for ${row.name}`}
                      items={[
                        { label: "View Details", icon: "visibility", href: `/dashboard/crawl/${row.id}` },
                        {
                          label: "Complete Crawl Now",
                          icon: "done_all",
                          disabled: readOnly || row.status !== "running",
                          onSelect: () => complete(row),
                        },
                        {
                          label: "Download Original",
                          icon: "download",
                          onSelect: async () => {
                            try {
                              await download(`/api/dashboard/crawl/${row.id}`, `${row.code}-crawl.json`);
                              toast("Original crawl downloaded.", "success");
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
                              await download(`/api/dashboard/crawl/${row.id}/export?format=csv`, `${row.code}-test-cases.csv`);
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
                              await download(`/api/dashboard/crawl/${row.id}/export?format=json`, `${row.code}-test-cases.json`);
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

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete crawl" footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button type="button" className={cn("inline-flex h-9 items-center rounded-lg bg-[#dc2626] px-3 text-[13px] font-medium text-white hover:bg-[#b91c1c]")} onClick={() => deleteTarget && void remove(deleteTarget)}>
            Delete crawl
          </button>
        </>
      }>
        <p className="text-[13px] text-[#4b5563]">
          Delete <strong>{deleteTarget?.name}</strong>? The crawl session is removed from the table and the database. Test cases already generated from it are preserved.
        </p>
      </Modal>
    </div>
  );
}
