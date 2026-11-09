"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CqaIcon, cqaBtnGhost, cqaCard } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export interface AuditRow {
  id: string;
  date: string;
  module: string;
  moduleId: string;
  details: string;
}

const MODULES = ["All modules", "Test case", "Test suite", "Test plan", "Environment", "Crawl", "Requirement", "API token", "Settings", "Integration", "Team"];

export function SystemAuditsTable({ rows }: { rows: AuditRow[] }) {
  const router = useRouter();
  const [module, setModule] = useState("All modules");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const filtered = useMemo(() => (module === "All modules" ? rows : rows.filter((r) => r.module === module)), [rows, module]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * size, current * size);
  const from = filtered.length === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(current * size, filtered.length);

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        {filterOpen && (
          <select
            aria-label="Filter module"
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setPage(1);
              setFilterOpen(false);
            }}
            className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2 text-[13px] text-[#374151] outline-none"
          >
            {MODULES.map((m) => <option key={m}>{m}</option>)}
          </select>
        )}
        <button type="button" aria-label="Refresh" className={cn(cqaBtnGhost, "size-9 border border-[#e5e7eb] bg-white p-0")} onClick={() => router.refresh()}>
          <CqaIcon name="refresh" className="text-[18px]" />
        </button>
        <button
          type="button"
          aria-label="Filter"
          aria-pressed={filterOpen}
          className={cn(cqaBtnGhost, "size-9 border bg-white p-0", filterOpen ? "border-[#a9a1f7] text-[#5b4ee8]" : "border-[#e5e7eb]")}
          onClick={() => setFilterOpen((v) => !v)}
        >
          <CqaIcon name="filter_alt" className="text-[18px]" />
        </button>
      </div>

      <div className={cn(cqaCard, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#f0f1f3] bg-white">
                {["Date", "Module & ID", "Details"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-5 py-3 text-[12.5px] font-medium text-[#4a5565]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[13px] text-[#374151]">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-14 text-center">
                    <p className="text-[14px] font-medium text-[#374151]">No audit events</p>
                    <p className="mt-1 text-[12.5px] text-[#9ca3af]">Actions you take will be recorded here.</p>
                  </td>
                </tr>
              )}
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-[#f3f4f6] bg-white transition last:border-0 hover:bg-[#fafafa]">
                  <td className="whitespace-nowrap px-5 py-[13px] tabular-nums text-[#4a5565]">{row.date}</td>
                  <td className="whitespace-nowrap px-5 py-[13px] text-[#4a5565]">{row.moduleId}</td>
                  <td className="px-5 py-[13px] text-[#111827]">{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f1f3] px-5 py-2.5 text-[12px] text-[#6b7280]">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              aria-label="Rows per page"
              className="h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]"
              value={size}
              onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="tabular-nums">{from}–{to} of {filtered.length}</span>
            <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)} className="rounded p-1 hover:bg-[#f3f4f6] disabled:opacity-40">
              <CqaIcon name="chevron_left" className="text-[18px]" />
            </button>
            <button type="button" aria-label="Next page" disabled={current >= pages} onClick={() => setPage(current + 1)} className="rounded p-1 hover:bg-[#f3f4f6] disabled:opacity-40">
              <CqaIcon name="chevron_right" className="text-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
