"use client";

import { useEffect, useRef, useState } from "react";
import { CqaIcon, cqaBtnGhost, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaIconBtn } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export interface FilterDef {
  key: string;
  label: string;
  options: string[];
}

export interface ColumnDef {
  key: string;
  label: string;
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer, true);
    document.addEventListener("touchstart", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer, true);
      document.removeEventListener("touchstart", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

/** Search + filter chips + visible-columns + refresh toolbar shared by every grid. */
export function DataToolbar({
  search,
  onSearch,
  placeholder = "Search",
  filters = [],
  activeFilters,
  onFiltersChange,
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  onRefresh,
  refreshing,
  actions,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  filters?: FilterDef[];
  activeFilters: Record<string, string>;
  onFiltersChange: (next: Record<string, string>) => void;
  columns?: ColumnDef[];
  visibleColumns?: Record<string, boolean>;
  onVisibleColumnsChange?: (next: Record<string, boolean>) => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  actions?: React.ReactNode;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const filterRef = useOutsideClose(filterOpen, () => setFilterOpen(false));
  const columnsRef = useOutsideClose(columnsOpen, () => setColumnsOpen(false));
  const active = Object.entries(activeFilters).filter(([, value]) => value && value !== "All");

  function addFilter(key: string) {
    const value = draft[key];
    if (!value || value === "All") return;
    onFiltersChange({ ...activeFilters, [key]: value });
    setDraft((current) => ({ ...current, [key]: "All" }));
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            aria-label="Search"
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
          />
        </div>

        {filters.length > 0 && (
          <div className="relative" ref={filterRef}>
            <button type="button" className={cqaBtnSecondary} aria-expanded={filterOpen} onClick={() => setFilterOpen((value) => !value)}>
              <CqaIcon name="add" className="text-[16px]" /> Filter
              {active.length > 0 && (
                <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-[#5b4ee8] text-[10px] font-semibold text-white">{active.length}</span>
              )}
            </button>
            {filterOpen && (
              <div
                data-filter-popover=""
                className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
              >
                <p className="mb-2 text-[12.5px] font-semibold text-[#111827]">Add a filter</p>
                <div className="space-y-2.5">
                  {filters.map((filter) => (
                    <div key={filter.key}>
                      <span className="mb-1 block text-[11.5px] font-medium text-[#6b7280]">{filter.label}</span>
                      <div className="flex gap-2">
                        <select
                          aria-label={`Filter by ${filter.label}`}
                          className="h-8 min-w-0 flex-1 rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px]"
                          value={draft[filter.key] ?? "All"}
                          onChange={(event) => setDraft((current) => ({ ...current, [filter.key]: event.target.value }))}
                        >
                          <option>All</option>
                          {filter.options.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                        <button type="button" className={cn(cqaBtnSecondary, "h-8 px-2.5 text-[12px]")} onClick={() => addFilter(filter.key)}>
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {onRefresh && (
          <button
            type="button"
            aria-label="Refresh"
            title="Refresh"
            onClick={() => void onRefresh()}
            disabled={refreshing}
            className={cn(cqaBtnGhost, "size-9 border border-[#e5e7eb] bg-white p-0")}
          >
            <CqaIcon name="refresh" className={cn("text-[18px]", refreshing && "animate-spin")} />
          </button>
        )}

        {columns && visibleColumns && onVisibleColumnsChange && (
          <div className="relative" ref={columnsRef}>
            <button
              type="button"
              aria-label="Table settings"
              title="Visible columns"
              aria-expanded={columnsOpen}
              onClick={() => setColumnsOpen((value) => !value)}
              className={cn(cqaBtnGhost, "size-9 border border-[#e5e7eb] bg-white p-0")}
            >
              <CqaIcon name="settings" className="text-[18px]" />
            </button>
            {columnsOpen && (
              <div
                data-columns-popover=""
                className="absolute right-0 top-full z-50 mt-1 w-60 rounded-lg border border-[#e5e7eb] bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
              >
                <p className="mb-2 text-[12.5px] font-semibold text-[#111827]">Visible columns</p>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {columns.map((column) => (
                    <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[#5b4ee8]"
                        checked={visibleColumns[column.key] !== false}
                        onChange={(event) => onVisibleColumnsChange({ ...visibleColumns, [column.key]: event.target.checked })}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {actions}
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {active.map(([key, value]) => {
            const label = filters.find((filter) => filter.key === key)?.label ?? key;
            return (
              <span
                key={key}
                data-filter-chip={key}
                className="inline-flex items-center gap-1 rounded-full border border-[#ddd8fb] bg-[#f5f3ff] px-2.5 py-1 text-[11.5px] font-medium text-[#4c3fd6]"
              >
                {label}: {value}
                <button
                  type="button"
                  aria-label={`Remove ${label} filter`}
                  onClick={() => {
                    const next = { ...activeFilters };
                    delete next[key];
                    onFiltersChange(next);
                  }}
                  className="rounded-full p-0.5 hover:bg-[#e4e1fd]"
                >
                  <CqaIcon name="close" className="text-[13px]" />
                </button>
              </span>
            );
          })}
          <button type="button" className="text-[11.5px] font-medium text-[#6b7280] underline-offset-2 hover:underline" onClick={() => onFiltersChange({})}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export function SelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div data-bulk-bar="" className="flex flex-wrap items-center gap-2 rounded-lg border border-[#ddd8fb] bg-[#f5f3ff] px-3 py-2 text-[12.5px] text-[#4c3fd6]">
      <span className="font-semibold">{count} selected</span>
      <span className="text-[#a5a0d8]">·</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      <button type="button" onClick={onClear} className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-[#e4e1fd]">
        <CqaIcon name="close" className="text-[14px]" /> Clear
      </button>
    </div>
  );
}

export function BulkButton({
  icon,
  children,
  onClick,
  danger,
  disabled,
}: {
  icon: string;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md border bg-white px-2 text-[12px] font-medium transition disabled:opacity-50",
        danger ? "border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]" : "border-[#ddd8fb] text-[#4c3fd6] hover:bg-[#faf9ff]",
      )}
    >
      <CqaIcon name={icon} className="text-[14px]" />
      {children}
    </button>
  );
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <select
          aria-label="Rows per page"
          className="h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]"
          value={pageSize}
          onChange={(event) => {
            onPageSize(Number(event.target.value));
            onPage(1);
          }}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="tabular-nums">
          {from}–{to} of {total}
        </span>
        <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => onPage(current - 1)} className={cn(cqaIconBtn, "size-7 border border-[#e5e7eb] bg-white")}>
          <CqaIcon name="chevron_left" className="text-[16px]" />
        </button>
        <button type="button" aria-label="Next page" disabled={current >= pages} onClick={() => onPage(current + 1)} className={cn(cqaIconBtn, "size-7 border border-[#e5e7eb] bg-white")}>
          <CqaIcon name="chevron_right" className="text-[16px]" />
        </button>
      </div>
    </div>
  );
}

export function SelectAllCheckbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (checked: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="size-3.5 rounded border-[#d1d5db] accent-[#5b4ee8]"
    />
  );
}

/**
 * Distinct, sorted option values for a categorical column filter.
 */
export function distinctColumnValues(values: Array<string | number | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter((value) => value && value !== "-"))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * Shared substring predicate for per-column filters. Categorical select
 * values and free-text input both match case-insensitively.
 */
export function matchesColumnFilters(
  columnFilters: Record<string, string>,
  values: Record<string, string | number | null | undefined>,
): boolean {
  for (const [column, needle] of Object.entries(columnFilters)) {
    if (!needle) continue;
    if (!String(values[column] ?? "").toLowerCase().includes(needle.toLowerCase())) return false;
  }
  return true;
}

/**
 * Per-column filter used inside a table header.
 *
 * Categorical columns pass `options` to render the distinct-value dropdown
 * alongside a free-text substring input. Text/date columns pass no options and
 * only render the substring search. A blue dot marks an active filter and the
 * popover exposes a one-click clear so no filter can get stuck.
 */
export function ColumnFilter({
  column,
  value,
  onChange,
  options = [],
  placeholder,
  testId,
}: {
  column: string;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  placeholder?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const active = Boolean(value);
  return (
    <span className="relative inline-flex align-middle" ref={ref}>
      <button
        type="button"
        aria-label={`Filter ${column}`}
        title={active ? `${column}: ${value}` : `Filter ${column}`}
        aria-expanded={open}
        data-column-filter={column}
        data-testid={testId}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={cn(
          "ml-1 inline-flex size-5 items-center justify-center rounded transition hover:bg-[#eef2ff]",
          active ? "text-[#4f46e5]" : "text-[#9ca3af]",
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 fill-current">
          <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
        </svg>
        {active && <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-[#5b4ee8]" />}      </button>
      {open && (
        <div
          data-column-filter-popover={column}
          className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border border-[#e5e7eb] bg-white p-3 text-left font-normal shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
        >
          <p className="mb-2 text-[12px] font-semibold text-[#111827]">Filter {column}</p>
          {options.length > 0 && (
            <select
              aria-label={`${column} distinct values`}
              className="mb-2 h-8 w-full rounded-md border border-[#e5e7eb] bg-white px-2 text-[12px] text-[#374151]"
              value={options.includes(value) ? value : ""}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">All {column.toLowerCase()} values</option>
              {options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          )}
          <input
            type="search"
            aria-label={`Filter ${column} text`}
            value={value}
            placeholder={placeholder ?? `Search ${column.toLowerCase()}…`}
            onChange={(event) => onChange(event.target.value)}
            className="h-8 w-full rounded-md border border-[#e5e7eb] px-2 text-[12px] text-[#374151] outline-none focus:border-[#a9a1f7]"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              className="text-[11.5px] font-medium text-[#6b7280] hover:underline"
              onClick={() => onChange("")}
            >
              Clear {column.toLowerCase()}
            </button>
            <button
              type="button"
              className={cn(cqaBtnSecondary, "h-7 px-2 text-[11.5px]")}
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

export function tableCardClass(className?: string) {
  // No overflow-hidden: toolbar popovers and RowMenu triggers inside the card
  // must never be clipped by the card boundary. Horizontal table scrolling is
  // handled by the inner overflow-x-auto wrapper.
  return cn(cqaCard, className);
}

/* ------------------------------------------------------------------ */
/* Phase 15 — universal table sorting                                  */
/* ------------------------------------------------------------------ */

export type SortDirection = "asc" | "desc";
export type TableSortState = {
  column: string;
  direction: SortDirection;
} | null;

/** Cycles a column between ascending, descending and unsorted. */
export function nextTableSort(current: TableSortState, column: string): TableSortState {
  if (!current || current.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return null;
}

function comparableSortValue(value: string | number | null | undefined): number | string {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^[\s$€£%(),.\d-]+$/.test(text)) {
    const numeric = Number(text.replace(/[$,€£%\s]/g, "").replace(/,/g, ""));
    if (Number.isFinite(numeric)) return numeric;
  }
  if (/\d{4}|\d{1,2}[\s/.-][A-Za-z]{3}/.test(text)) {
    const timestamp = Date.parse(text);
    if (!Number.isNaN(timestamp)) return timestamp;
  }
  return text.toLowerCase();
}

/** Stable comparator for numbers, currency/percentages, dates and strings. */
export function sortTableRows<T>(
  rows: T[],
  sort: TableSortState,
  accessors: Record<string, (row: T) => string | number | null | undefined>,
): T[] {
  if (!sort) return rows;
  const accessor = accessors[sort.column];
  if (!accessor) return rows;
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = comparableSortValue(accessor(left));
    const b = comparableSortValue(accessor(right));
    if (typeof a === "number" && typeof b === "number") return (a - b) * factor;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }) * factor;
  });
}

/**
 * Compact sort trigger rendered beside ColumnFilter. The arrow is an inline SVG
 * so the header's accessible/text content (used by parity checks) is unchanged.
 */
export function ColumnSort({
  column,
  sort,
  onSort,
}: {
  column: string;
  sort: TableSortState;
  onSort: (column: string) => void;
}) {
  const active = sort?.column === column;
  const direction = active ? sort.direction : null;
  const label = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "unsorted";
  return (
    <button
      type="button"
      aria-label={`Sort ${column}`}
      title={`Sort ${column} · ${label}`}
      data-column-sort={column}
      data-sort-direction={direction ?? "none"}
      onClick={(event) => {
        event.stopPropagation();
        onSort(column);
      }}
      className={cn(
        "ml-0.5 inline-flex size-5 items-center justify-center rounded transition hover:bg-[#eef2ff]",
        active ? "text-[#4f46e5]" : "text-[#9ca3af]",
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3 fill-current">
        {direction === "asc" && <path d="M12 5l6 8H6z" />}
        {direction === "desc" && <path d="M12 19l6-8H6z" />}
        {direction === null && <path d="M12 4l4 6H8zM12 20l-4-6h8z" />}
      </svg>
    </button>
  );
}
