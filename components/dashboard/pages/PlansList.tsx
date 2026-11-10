"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CqaIcon, Modal, StatusPill, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaInput, cqaLabel, useAction } from "@/components/dashboard/ui";
import { RowMenu } from "@/components/contextqa/row-menu";
import { BulkButton, DataToolbar, SelectAllCheckbox, SelectionBar, TablePagination } from "@/components/contextqa/table-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface PlanRow {
  id: string;
  name: string;
  module: string;
  environment: string;
  schedule: string;
  suites: number;
  cases: number;
  passRate: number;
  lastRunAt: string | null;
  createdAt: string;
}

const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "suites", label: "Suites" },
  { key: "cases", label: "Test Cases" },
  { key: "result", label: "Latest Result" },
  { key: "environment", label: "Environment" },
  { key: "schedule", label: "Schedule" },
  { key: "lastRun", label: "Last Run" },
];

function planResult(plan: PlanRow) {
  if (!plan.lastRunAt) return null;
  return plan.passRate >= 99 ? "Passed" : "Failed";
}

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function PlansList({ rows, readOnly, actions }: { rows: PlanRow[]; readOnly: boolean; actions?: React.ReactNode }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [isRefreshing, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(COLUMNS.map((column) => [column.key, true])));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [localRows, setLocalRows] = useState(rows);
  const [deleteTarget, setDeleteTarget] = useState<PlanRow | null>(null);
  const [editTarget, setEditTarget] = useState<PlanRow | null>(null);

  useEffect(() => setLocalRows(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return localRows.filter((plan) => {
      if (q && ![plan.name, plan.module, plan.environment, plan.schedule].some((value) => value.toLowerCase().includes(q))) return false;
      if (filters.result && planResult(plan) !== filters.result) return false;
      if (filters.environment && (plan.environment || "Any") !== filters.environment) return false;
      if (filters.module && (plan.module || "Unorganised") !== filters.module) return false;
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

  function setVisibleColumns(next: Record<string, boolean>) {
    setVisible(next);
    window.localStorage.setItem("qasyn.plans.columns", JSON.stringify(next));
  }

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function runPlan(plan: PlanRow) {
    const result = await run<{ passed: number; failed: number; total: number }>("run", "/api/dashboard/test-plans/run", {
      json: { planId: plan.id },
    });
    if (result) {
      setLocalRows((current) =>
        current.map((row) =>
          row.id === plan.id
            ? { ...row, lastRunAt: new Date().toISOString(), passRate: result.total ? Math.round((result.passed / result.total) * 1000) / 10 : 0 }
            : row,
        ),
      );
      toast(`Plan "${plan.name}" ran · ${result.passed}/${result.total} passed.`, result.failed ? "info" : "success");
      router.refresh();
    }
  }

  async function clonePlan(plan: PlanRow) {
    await run("clone", `/api/dashboard/collections/test-plans/${plan.id}`, {
      method: "PATCH",
      json: { action: "clone" },
      success: `Plan "${plan.name}" cloned.`,
    });
  }

  async function removePlan(plan: PlanRow) {
    const res = await apiFetch<{ ok: boolean }>(`/api/dashboard/collections/test-plans/${plan.id}`, { method: "DELETE" });
    if (res?.ok) {
      setLocalRows((current) => current.filter((row) => row.id !== plan.id));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(plan.id);
        return next;
      });
      toast(`Plan "${plan.name}" deleted.`, "success");
      router.refresh();
    }
    setDeleteTarget(null);
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const targets = localRows.filter((row) => selected.has(row.id));
    try {
      await Promise.all(targets.map((target) => apiFetch(`/api/dashboard/collections/test-plans/${target.id}`, { method: "DELETE" })));
      const ids = new Set(targets.map((target) => target.id));
      setLocalRows((current) => current.filter((row) => !ids.has(row.id)));
      setSelected(new Set());
      toast(`${targets.length} plan${targets.length === 1 ? "" : "s"} deleted.`, "success");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  async function runSelected() {
    if (selected.size === 0) return;
    const targets = localRows.filter((row) => selected.has(row.id));
    let passed = 0;
    let failed = 0;
    try {
      for (const target of targets) {
        const result = await apiFetch<{ passed: number; failed: number }>("/api/dashboard/test-plans/run", {
          json: { planId: target.id },
        });
        passed += result?.passed ?? 0;
        failed += result?.failed ?? 0;
      }
      toast(`Ran ${targets.length} plans · ${passed} passed · ${failed} failed.`, failed ? "info" : "success");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  function exportRows(targets: PlanRow[]) {
    const lines = [
      ["Name", "Suites", "Test Cases", "Result", "Environment", "Schedule", "Last Run"].join(","),
      ...targets.map((row) =>
        [row.name, row.suites, row.cases, planResult(row) ?? "Not Executed", row.environment || "Any", row.schedule, row.lastRunAt ? formatDate(row.lastRunAt) : "Never"]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "test-plans-report.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast(`${targets.length} plan${targets.length === 1 ? "" : "s"} exported.`, "success");
  }

  return (
    <div className="space-y-3">
      <DataToolbar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder="Search test plans"
        filters={[
          { key: "result", label: "Latest Result", options: ["Passed", "Failed"] },
          { key: "environment", label: "Environment", options: [...new Set(localRows.map((row) => row.environment).filter(Boolean))] },
          { key: "module", label: "Folder", options: [...new Set(localRows.map((row) => row.module || "Unorganised"))] },
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
        <BulkButton icon="play_arrow" disabled={readOnly || pending !== null} onClick={() => void runSelected()}>
          Run selected
        </BulkButton>
        <BulkButton icon="upload" onClick={() => exportRows(localRows.filter((row) => selected.has(row.id)))}>
          Export CSV
        </BulkButton>
        <BulkButton icon="delete" danger disabled={readOnly || pending !== null} onClick={() => void deleteSelected()}>
          Delete selected
        </BulkButton>
      </SelectionBar>

      <div className={cn(cqaCard, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#f0f1f3]">
                <th className="w-9 px-4 py-3">
                  <SelectAllCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} label="Select all test plans" />
                </th>
                <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Name</th>
                {visible.suites && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Suites</th>}
                {visible.cases && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Test Cases</th>}
                {visible.result && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Latest Result</th>}
                {visible.environment && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Environment</th>}
                {visible.schedule && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Schedule</th>}
                {visible.lastRun && <th className="px-4 py-3 text-[12px] font-medium text-[#6b7280]">Last Run</th>}
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <p className="text-[14px] font-medium text-[#374151]">No test plans yet</p>
                    <p className="mt-1 text-[12.5px] text-[#9ca3af]">Create a plan to group suites and schedule runs.</p>
                  </td>
                </tr>
              )}
              {pageRows.map((plan) => {
                const result = planResult(plan);
                return (
                  <tr key={plan.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${plan.name}`}
                        checked={selected.has(plan.id)}
                        onChange={() => toggleOne(plan.id)}
                        className="size-3.5 accent-[#5b4ee8]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/plans/test-plans/${plan.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{plan.name}</Link>
                      <p className="mt-0.5 text-[12px] text-[#6b7280]">{plan.module || "Unorganised"} · {plan.cases} cases</p>
                    </td>
                    {visible.suites && <td className="px-4 py-3 text-[#4b5563]">{plan.suites}</td>}
                    {visible.cases && <td className="px-4 py-3 text-[#4b5563]">{plan.cases}</td>}
                    {visible.result && (
                      <td className="px-4 py-3">
                        {result ? <StatusPill value={result} /> : <span className="text-[#9ca3af]">—</span>}
                      </td>
                    )}
                    {visible.environment && <td className="px-4 py-3 text-[#4b5563]">{plan.environment || "Any"}</td>}
                    {visible.schedule && <td className="px-4 py-3 text-[#4b5563] capitalize">{plan.schedule.replace("_", " ")}</td>}
                    {visible.lastRun && <td className="whitespace-nowrap px-4 py-3 text-[#6b7280]">{plan.lastRunAt ? formatDate(plan.lastRunAt) : "Never"}</td>}
                    <td className="px-4 py-3">
                      <RowMenu
                        label={`Actions for ${plan.name}`}
                        items={[
                          { label: "Open Plan", icon: "visibility", href: `/dashboard/plans/test-plans/${plan.id}` },
                          { label: "Run Plan", icon: "play_arrow", disabled: readOnly, onSelect: () => runPlan(plan) },
                          { label: "Clone", icon: "content_copy", disabled: readOnly, onSelect: () => clonePlan(plan) },
                          { label: "Edit", icon: "edit", disabled: readOnly, onSelect: () => setEditTarget(plan) },
                          { label: "Export Report", icon: "download", onSelect: () => exportRows([plan]) },
                          { label: "Delete", icon: "delete", danger: true, disabled: readOnly, onSelect: () => setDeleteTarget(plan) },
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

      <PlanEditModal
        plan={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          router.refresh();
        }}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete test plan"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg bg-[#dc2626] px-3 text-[13px] font-medium text-white hover:bg-[#b91c1c]"
              onClick={() => deleteTarget && void removePlan(deleteTarget)}
            >
              Delete plan
            </button>
          </>
        }
      >
        <p className="text-[13px] text-[#4b5563]">
          Delete <strong>{deleteTarget?.name}</strong>? The plan is removed from SQLite. Suites and test cases are preserved.
        </p>
      </Modal>
    </div>
  );
}

function PlanEditModal({ plan, onClose, onSaved }: { plan: PlanRow | null; onClose: () => void; onSaved: () => void }) {
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [module, setModule] = useState("");
  const [environment, setEnvironment] = useState("");

  useEffect(() => {
    if (!plan) return;
    setName(plan.name);
    setModule(plan.module);
    setEnvironment(plan.environment);
    setError(null);
  }, [plan, setError]);

  if (!plan) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!plan) return;
    const res = await run("plan-edit", `/api/dashboard/collections/test-plans/${plan.id}`, {
      method: "PATCH",
      json: { action: "update", name, module, environment },
      success: `Plan "${name}" saved.`,
    });
    if (res) onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Edit test plan" footer={
      <>
        <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
        <button type="submit" form="plan-edit-form" className={cqaBtnPrimary} disabled={pending === "plan-edit"}>
          {pending === "plan-edit" ? "Saving…" : "Save changes"}
        </button>
      </>
    }>
      <form id="plan-edit-form" onSubmit={submit} className="space-y-3">
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
            <span className={cqaLabel}>Environment</span>
            <select className={cqaInput} value={environment} onChange={(event) => setEnvironment(event.target.value)}>
              <option value="">Any</option>
              {["Production", "Staging", "QA", "Localhost"].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
