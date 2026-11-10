"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { RowMenu } from "@/components/contextqa/row-menu";
import { BulkButton, DataToolbar, SelectAllCheckbox, SelectionBar, TablePagination } from "@/components/contextqa/table-ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
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
  folderId: string | null;
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
  steps: ParityStep[];
}

export interface ParityFolder {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface ParityStep {
  id: string;
  action: string;
  target: string;
  value: string;
  selector: string;
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
  folders,
  modules,
  readOnly,
  openNew,
  initialTab,
  userName,
  orgUrl,
}: {
  rows: ParityTestCase[];
  groups: ParityStepGroup[];
  folders: ParityFolder[];
  modules: string[];
  readOnly: boolean;
  openNew: boolean;
  initialTab: "cases" | "groups";
  userName: string;
  orgUrl: string;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [isRefreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<"cases" | "groups">(initialTab);
  const [view, setView] = useState<"list" | "modular">("list");
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("All Test Cases");
  const [groupScope, setGroupScope] = useState("All Step Groups");
  const [newOpen, setNewOpen] = useState(openNew && !readOnly);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ParityStepGroup | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(COLUMNS.map((c) => [c, true])),
  );
  const [folder, setFolder] = useState<string>("All");
  const [folderModal, setFolderModal] = useState<{ mode: "create" | "rename" | "move" | "delete"; folder?: ParityFolder } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<ParityTestCase | null>(null);
  const [moveTarget, setMoveTarget] = useState<ParityTestCase | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (q && !`${r.title} ${r.code} ${r.module} ${r.folder}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (scope === "My Test Cases" && r.createdBy !== userName) return false;
        if (folder === "unfiled" && r.folderId) return false;
        if (folder !== "All" && folder !== "unfiled" && r.folderId !== folder) return false;
        if (filters.status && stateOf(r.status) !== filters.status) return false;
        if (filters.priority && priorityOf(r.criticality) !== filters.priority) return false;
        if (filters.result && resultOf(r.status) !== filters.result) return false;
        if (filters.module && r.module !== filters.module) return false;
        if (filters.createdBy && r.createdBy !== filters.createdBy) return false;
        if (filters.testType && "Functional" !== filters.testType) return false;
        if (filters.type && "Functional" !== filters.type) return false;
        if (filters.suite && (filters.suite === "Yes") !== Boolean(r.status === "passing")) return false;
        if (filters.labels && !r.labels.includes(filters.labels)) return false;
        return true;
      }),
    [rows, q, scope, folder, filters, userName],
  );

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page > pages) setPage(pages);
  }, [filtered.length, page, pageSize]);

  const filteredGroups = groups.filter((g) => {
    if (q && !`${g.name} ${g.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (groupScope === "With Steps") return g.stepsCount > 0;
    if (groupScope === "Without Steps") return g.stepsCount === 0;
    return true;
  });

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function deleteCase() {
    if (!deleteTarget) return;
    const res = await run("delete", `/api/dashboard/test-cases/${deleteTarget.id}`, { method: "DELETE", success: `"${deleteTarget.title}" deleted.` });
    if (res) {
      setSelected((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
    }
  }

  async function updateModule(id: string, current: string) {
    const module = window.prompt("Update module", current);
    if (!module) return;
    await run(`mod-${id}`, `/api/dashboard/test-cases/${id}`, { method: "PATCH", json: { action: "edit", module } });
  }

  async function deleteGroup(id: string) {
    if (!window.confirm("Delete this step group?")) return;
    const target = groups.find((group) => group.id === id);
    await run(`group-del-${id}`, `/api/dashboard/test-components/${id}`, { method: "DELETE", success: `Step group "${target?.name ?? ""}" deleted.` });
  }

  async function duplicateGroup(group: ParityStepGroup) {
    await run(`group-dup-${group.id}`, "/api/dashboard/test-components", {
      json: { name: `${group.name} (Copy)`, description: group.description, steps: group.steps },
      success: `Step group "${group.name}" duplicated.`,
    });
  }

  async function runCase(testCase: ParityTestCase) {
    const result = await run<{ passed: number; failed: number }>("run", `/api/dashboard/test-cases/${testCase.id}`, {
      method: "PATCH",
      json: { action: "run" },
    });
    if (result) toast(`"${testCase.title}" ${result.failed ? "failed" : "passed"}.`, result.failed ? "error" : "success");
  }

  async function cloneCase(testCase: ParityTestCase) {
    await run("clone", `/api/dashboard/test-cases/${testCase.id}`, {
      method: "PATCH",
      json: { action: "clone" },
      success: `"${testCase.title}" cloned.`,
    });
  }

  async function moveCase(destination: string | null) {
    if (!moveTarget) return;
    const res = await run("move", `/api/dashboard/test-cases/${moveTarget.id}`, {
      method: "PATCH",
      json: { action: "move", folderId: destination },
      success: `"${moveTarget.title}" moved.`,
    });
    if (res) setMoveTarget(null);
  }

  async function exportPlaywright(testCase: ParityTestCase) {
    try {
      const res = await fetch(`/api/dashboard/test-cases/${testCase.id}/export`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Export failed (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${testCase.code.toLowerCase()}.spec.ts`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast("Playwright spec exported.", "success");
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  async function runSelected() {
    if (selected.size === 0) return;
    const result = await run<{ passed: number; failed: number; total: number }>("bulk-run", "/api/dashboard/test-cases/run-batch", {
      json: { testCaseIds: [...selected] },
    });
    if (result) toast(`Ran ${result.total} test cases · ${result.passed} passed · ${result.failed} failed.`, result.failed ? "info" : "success");
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const targets = rows.filter((row) => selected.has(row.id));
    try {
      await Promise.all(targets.map((row) => apiFetch(`/api/dashboard/test-cases/${row.id}`, { method: "DELETE" })));
      setSelected(new Set());
      toast(`${targets.length} test case${targets.length === 1 ? "" : "s"} deleted.`, "success");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  function exportSelected() {
    const targets = rows.filter((row) => selected.has(row.id));
    const lines = [
      ["Code", "Title", "Module", "Folder", "Priority", "Result", "Status", "Last Run"].join(","),
      ...targets.map((row) =>
        [row.code, row.title, row.module, row.folder, priorityOf(row.criticality), resultOf(row.status), stateOf(row.status), fmt(row.lastRunAt)]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "test-cases.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast(`${targets.length} test case${targets.length === 1 ? "" : "s"} exported.`, "success");
  }

  const heading = tab === "cases" ? "Test Cases" : "Step Groups";
  const subheading =
    tab === "cases"
      ? "Manage and Execute all your Test Cases"
      : "Manage and organize reusable step groups";

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
      <DataToolbar
        search={q}
        onSearch={(value) => {
          setQ(value);
          setPage(1);
        }}
        placeholder="Search test cases"
        filters={
          tab === "cases"
            ? [
                { key: "status", label: "Status", options: ["Ready", "In Review", "Draft"] },
                { key: "priority", label: "Priority", options: ["High", "Medium", "Low"] },
                { key: "result", label: "Latest Run Result", options: ["Passed", "Failed", "Not Executed"] },
                { key: "module", label: "Module", options: modules },
                { key: "createdBy", label: "Created By", options: [...new Set(rows.map((row) => row.createdBy))] },
              ]
            : []
        }
        activeFilters={filters}
        onFiltersChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        columns={tab === "cases" ? COLUMNS.map((column) => ({ key: column, label: column })) : undefined}
        visibleColumns={tab === "cases" ? visibleColumns : undefined}
        onVisibleColumnsChange={tab === "cases" ? setVisibleColumns : undefined}
        onRefresh={refresh}
        refreshing={isRefreshing}
        actions={
          <>
            {tab === "cases" ? (
              <select aria-label="Scope" className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[12.5px] text-[#374151]" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option>All Test Cases</option>
                <option>My Test Cases</option>
                <option>Suite Cases</option>
              </select>
            ) : (
              <select
                aria-label="All Step Groups"
                className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[12.5px] text-[#374151]"
                value={groupScope}
                onChange={(e) => setGroupScope(e.target.value)}
              >
                <option>All Step Groups</option>
                <option>With Steps</option>
                <option>Without Steps</option>
              </select>
            )}
            {tab === "cases" ? (
              <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setNewOpen(true)}>
                <CqaIcon name="add" className="text-[17px]" /> New Test Case
              </button>
            ) : (
              <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setNewGroupOpen(true)}>
                <CqaIcon name="add" className="text-[17px]" /> New Step Group
              </button>
            )}
          </>
        }
      />

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
                  <RowMenu
                    label={`Actions for ${group.name}`}
                    items={[
                      { label: "Edit step group", icon: "edit_square", disabled: readOnly, onSelect: () => setEditGroup(group) },
                      { label: "Duplicate", icon: "content_copy", disabled: readOnly, onSelect: () => duplicateGroup(group) },
                      { label: "Insert in Studio", icon: "input", href: `/dashboard/test-studio${rows[0] ? `/${rows[0].id}?group=${group.id}` : ""}` },
                      { label: "Delete", icon: "delete", danger: true, disabled: readOnly, onSelect: () => deleteGroup(group.id) },
                    ]}
                  />
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
          <StepGroupsTable
            groups={filteredGroups}
            readOnly={readOnly}
            onDelete={deleteGroup}
            onEdit={setEditGroup}
            onDuplicate={duplicateGroup}
            insertHref={rows[0] ? `/dashboard/test-studio/${rows[0].id}` : "/dashboard/test-studio"}
          />
        )
      ) : view === "modular" ? (
        <ModularView
          rows={rows}
          folders={folders}
          folder={folder}
          setFolder={setFolder}
          onOpenCase={(id) => router.push(`/dashboard/test-studio/${id}`)}
          onNewFolder={() => setFolderModal({ mode: "create" })}
          onRenameFolder={(target) => setFolderModal({ mode: "rename", folder: target })}
          onMoveFolder={(target) => setFolderModal({ mode: "move", folder: target })}
          onDeleteFolder={(target) => setFolderModal({ mode: "delete", folder: target })}
        />
      ) : (
        <>
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <BulkButton icon="play_arrow" disabled={readOnly || pending !== null} onClick={() => void runSelected()}>
              Run selected
            </BulkButton>
            <BulkButton icon="upload" onClick={exportSelected}>
              Export CSV
            </BulkButton>
            <BulkButton icon="delete" danger disabled={readOnly || pending !== null} onClick={() => void deleteSelected()}>
              Delete selected
            </BulkButton>
          </SelectionBar>
          <CasesTable
            rows={pageRows}
            visible={visibleColumns}
            readOnly={readOnly}
            selected={selected}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleAll={toggleAll}
            onToggleOne={toggleOne}
            onDelete={setDeleteTarget}
            onUpdateModule={updateModule}
            onRun={runCase}
            onClone={cloneCase}
            onMove={setMoveTarget}
            onExport={exportPlaywright}
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        </>
      )}

      <NewTestCaseModal open={newOpen} onClose={() => setNewOpen(false)} modules={modules} readOnly={readOnly} orgUrl={orgUrl} />
      <NewStepGroupModal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} readOnly={readOnly} cases={rows} />
      <StepGroupEditor open={Boolean(editGroup)} group={editGroup} onClose={() => setEditGroup(null)} readOnly={readOnly} />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete test case"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button type="button" className="inline-flex h-9 items-center rounded-lg bg-[#dc2626] px-3 text-[13px] font-medium text-white hover:bg-[#b91c1c]" onClick={() => void deleteCase()}>
              Delete test case
            </button>
          </>
        }
      >
        <p className="text-[13px] text-[#4b5563]">
          Delete <strong>{deleteTarget?.title}</strong>? It is removed from the grid and SQLite, along with its runs and versions.
        </p>
      </Modal>

      <Modal
        open={Boolean(moveTarget)}
        onClose={() => setMoveTarget(null)}
        title={`Move "${moveTarget?.title ?? ""}" to folder`}
      >
        <div className="space-y-1.5">
          <button type="button" className="flex w-full items-center gap-2 rounded-md border border-[#e5e7eb] px-3 py-2 text-left text-[13px] hover:bg-[#f9fafb]" onClick={() => void moveCase(null)}>
            <CqaIcon name="folder_off" className="text-[17px] text-[#9ca3af]" /> Unfiled
          </button>
          {folders.map((target) => (
            <button key={target.id} type="button" className="flex w-full items-center gap-2 rounded-md border border-[#e5e7eb] px-3 py-2 text-left text-[13px] hover:bg-[#f9fafb]" onClick={() => void moveCase(target.id)}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: target.color }} /> {target.name}
              <span className="ml-auto text-[11.5px] text-[#9ca3af]">{target.count} cases</span>
            </button>
          ))}
          {folders.length === 0 && <p className="text-[12.5px] text-[#6b7280]">No folders yet. Create one in Modular view.</p>}
        </div>
      </Modal>

      <FolderModal
        state={folderModal}
        folders={folders}
        rows={rows}
        readOnly={readOnly}
        onClose={() => setFolderModal(null)}
        onDone={() => {
          setFolderModal(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function CasesTable({
  rows,
  visible,
  readOnly,
  selected,
  allSelected,
  someSelected,
  onToggleAll,
  onToggleOne,
  onDelete,
  onUpdateModule,
  onRun,
  onClone,
  onMove,
  onExport,
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  rows: ParityTestCase[];
  visible: Record<string, boolean>;
  readOnly: boolean;
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onDelete: (row: ParityTestCase) => void;
  onUpdateModule: (id: string, current: string) => void;
  onRun: (row: ParityTestCase) => void;
  onClone: (row: ParityTestCase) => void;
  onMove: (row: ParityTestCase) => void;
  onExport: (row: ParityTestCase) => void;
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  return (
    <div className={cn(cqaCard, "overflow-hidden")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#f0f1f3]">
              <th className="w-9 px-3 py-3">
                <SelectAllCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={onToggleAll} label="Select all test cases" />
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Test Cases</th>
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
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.title}`}
                      checked={selected.has(r.id)}
                      onChange={() => onToggleOne(r.id)}
                      className="size-3.5 accent-[#5b4ee8]"
                    />
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
                  {visible.Folder && <td className="whitespace-nowrap px-3 py-3 text-[12.5px] text-[#4b5563]">{r.folder || "Unfiled"}</td>}
                  {visible["Created At"] && <td className="whitespace-nowrap px-3 py-3 text-[12px] text-[#6b7280]">{fmt(r.createdAt)}</td>}
                  {visible["Updated At"] && <td className="whitespace-nowrap px-3 py-3 text-[12px] text-[#6b7280]">{fmt(r.updatedAt)}</td>}
                  {visible["Last Run"] && <td className="whitespace-nowrap px-3 py-3 text-[12px] text-[#6b7280]">{fmt(r.lastRunAt)}</td>}
                  <td className="px-3 py-3">
                    <RowMenu
                      label={`Actions for ${r.title}`}
                      items={[
                        { label: "Edit in Studio", icon: "edit_square", href: `/dashboard/test-studio/${r.id}` },
                        { label: "View Details", icon: "visibility", href: `/dashboard/test-studio/${r.id}` },
                        { label: "Run Test", icon: "play_arrow", disabled: readOnly, onSelect: () => onRun(r) },
                        { label: "Clone", icon: "content_copy", disabled: readOnly, onSelect: () => onClone(r) },
                        { label: "Move to Folder", icon: "drive_file_move", disabled: readOnly, onSelect: () => onMove(r) },
                        { label: "Export Playwright", icon: "download", onSelect: () => onExport(r) },
                        { label: "Update Module", icon: "category", disabled: readOnly, onSelect: () => onUpdateModule(r.id, r.module) },
                        { label: "Delete", icon: "delete", danger: true, disabled: readOnly, onSelect: () => onDelete(r) },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} pageSize={pageSize} total={total} onPage={onPage} onPageSize={onPageSize} />
    </div>
  );
}

function StepGroupsTable({
  groups,
  readOnly,
  onDelete,
  onEdit,
  onDuplicate,
  insertHref,
}: {
  groups: ParityStepGroup[];
  readOnly: boolean;
  onDelete: (id: string) => void;
  onEdit: (group: ParityStepGroup) => void;
  onDuplicate: (group: ParityStepGroup) => void;
  insertHref: string;
}) {
  return (
    <div className={cn(cqaCard, "overflow-hidden")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
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
                <td className="px-4 py-3">
                  <p className="font-medium text-[#1f2937]">{g.name}</p>
                  <p className="mt-0.5 text-[11px] text-[#9ca3af]">{g.stepsCount} steps</p>
                </td>
                <td className="max-w-[360px] px-4 py-3 text-[12.5px] text-[#6b7280]">{g.description || "-"}</td>
                <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{g.stepsCount}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#6b7280]">{fmt(g.createdAt)}</td>
                <td className="px-4 py-3">
                  <RowMenu
                    label={`Actions for ${g.name}`}
                    items={[
                      { label: "Edit step group", icon: "edit_square", disabled: readOnly, onSelect: () => onEdit(g) },
                      { label: "Duplicate", icon: "content_copy", disabled: readOnly, onSelect: () => onDuplicate(g) },
                      { label: "Insert in Studio", icon: "input", href: `${insertHref}${insertHref.includes("?") ? "&" : "?"}group=${g.id}` },
                      { label: "Delete", icon: "delete", danger: true, disabled: readOnly, onSelect: () => onDelete(g.id) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModularView({
  rows,
  folders,
  folder,
  setFolder,
  onOpenCase,
  onNewFolder,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
}: {
  rows: ParityTestCase[];
  folders: ParityFolder[];
  folder: string;
  setFolder: (f: string) => void;
  onOpenCase: (id: string) => void;
  onNewFolder: () => void;
  onRenameFolder: (target: ParityFolder) => void;
  onMoveFolder: (target: ParityFolder) => void;
  onDeleteFolder: (target: ParityFolder) => void;
}) {
  const [folderQ, setFolderQ] = useState("");
  const shown = folders.filter((f) => !folderQ || f.name.toLowerCase().includes(folderQ.toLowerCase()));
  const unfiled = rows.filter((r) => !r.folderId).length;
  const visibleRows = rows.filter((r) => {
    if (folder === "All") return true;
    if (folder === "unfiled") return !r.folderId;
    return r.folderId === folder;
  });
  const activeFolder = folders.find((f) => f.id === folder);
  const title = folder === "All" ? "All test cases" : folder === "unfiled" ? "Unfiled" : activeFolder?.name ?? "Folder";

  return (
    <div className={cn(cqaCard, "grid min-h-[420px] grid-cols-1 lg:grid-cols-[280px_1fr]")}>
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
          <button type="button" onClick={onNewFolder} className="text-[11.5px] font-medium text-[#5b4ee8] hover:underline">+ New folder</button>
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
          {shown.map((target) => (
            <div key={target.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFolder(target.id)}
                className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]", folder === target.id ? "bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "text-[#374151] hover:bg-[#f9fafb]")}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: target.color }} />
                <span className="truncate">{target.name}</span>
                <span className="ml-auto text-[11px] text-[#9ca3af]">{target.count}</span>
              </button>
              <RowMenu
                label={`Actions for folder ${target.name}`}
                items={[
                  { label: "Rename", icon: "edit_square", onSelect: () => onRenameFolder(target) },
                  { label: "Move to folder", icon: "drive_file_move", onSelect: () => onMoveFolder(target) },
                  { label: "Delete", icon: "delete", danger: true, onSelect: () => onDeleteFolder(target) },
                ]}
              />
            </div>
          ))}
          {shown.length === 0 && <p className="px-2 py-2 text-[12px] text-[#9ca3af]">{folders.length === 0 ? "No folders yet." : "No folder matches."}</p>}
        </div>
        <div className="mt-4 border-t border-[#f0f1f3] pt-3">
          <button
            type="button"
            onClick={() => setFolder("unfiled")}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px]", folder === "unfiled" ? "bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "text-[#374151] hover:bg-[#f9fafb]")}
          >
            <CqaIcon name="folder_off" className="text-[17px] text-[#9ca3af]" /> Unfiled
            <span className="ml-auto text-[11px] text-[#9ca3af]">{unfiled}</span>
          </button>
        </div>
      </aside>
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-[#111827]">{title}</h2>
          <span className="text-[12px] text-[#6b7280]">{visibleRows.length} cases</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRows.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-[#e5e7eb] bg-[#fafafa] px-5 py-14 text-center">
              <p className="text-[13.5px] font-medium text-[#374151]">No test cases in this folder</p>
              <p className="mt-1 text-[12px] text-[#9ca3af]">Move cases here from the row actions in list view.</p>
            </div>
          )}
          {visibleRows.slice(0, 24).map((r) => (
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

function NewTestCaseModal({ open, onClose, modules, readOnly, orgUrl }: { open: boolean; onClose: () => void; modules: string[]; readOnly: boolean; orgUrl: string }) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [method, setMethod] = useState<"ai" | "import" | "record" | "manual">("ai");
  const [step, setStep] = useState(1);
  const [module, setModule] = useState(modules[0] ?? "Core");
  const [priority, setPriority] = useState("medium");
  const [title, setTitle] = useState("");
  const [stepsCount, setStepsCount] = useState(3);
  const [url, setUrl] = useState(orgUrl);
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
    setUrl(orgUrl);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const targetUrl = url.trim() || orgUrl;
    if (method === "record") {
      router.push(`/dashboard/recorder${targetUrl ? `?url=${encodeURIComponent(targetUrl)}` : ""}`);
      close();
      return;
    }
    if (method === "import") {
      const parsed = prompt
        .split("\n")
        .map((line) => line.split(","))
        .filter((parts) => parts.length >= 2 && parts[0] && parts[1]);
      for (const [t, m] of parsed) {
        await run("import", "/api/dashboard/test-cases", {
          json: { mode: "manual", title: t.trim(), module: (m || module).trim(), criticality: priority, stepsCount, targetUrl },
        });
      }
      router.refresh();
      close();
      return;
    }
    const json =
      method === "manual"
        ? { mode: "manual", title, module, criticality: priority, stepsCount, targetUrl }
        : { mode: "ai", module, criticality: priority, prompt: prompt || (targetUrl ? `Explore ${targetUrl}` : ""), count, targetUrl };
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
            <label className="block">
              <span className={cqaLabel}>Target URL</span>
              <input
                className={cqaInput}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.cgi.com"
                type="url"
                required
                autoComplete="url"
                data-testid="test-case-target-url"
              />
              <span className="mt-1 block text-[11px] text-[#9ca3af]">
                Every generated step and the <code className="rounded bg-[#f3f4f6] px-1">url</code> variable use this address. Pre-filled from your organisation.
              </span>
            </label>
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
                {pending === "create" ? "CreatingÔÇª" : "Create Test Case"}
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

const STEP_ACTIONS = [
  "Navigate",
  "Click",
  "Enter Text",
  "Verify Element",
  "AI Assertion",
  "API Call",
  "OCR/Document Validation",
  "KYC Check",
  "Salesforce Workflow Steps",
];

function blankStep(index: number): ParityStep {
  return { id: `s${Date.now().toString(36)}${index}`, action: "Click", target: "", value: "", selector: "" };
}

function StepEditorList({
  steps,
  onChange,
  readOnly,
}: {
  steps: ParityStep[];
  onChange: (next: ParityStep[]) => void;
  readOnly: boolean;
}) {
  function update(id: string, patch: Partial<ParityStep>) {
    onChange(steps.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[150px_1fr_1fr_1fr_32px] gap-2 px-1 text-[11px] font-medium text-[#6b7280] lg:grid">
        <span>Action</span>
        <span>Target</span>
        <span>Value</span>
        <span>Selector</span>
        <span />
      </div>
      {steps.map((step, index) => (
        <div key={step.id} className="grid gap-2 rounded-lg border border-[#e5e7eb] bg-white p-2 lg:grid-cols-[150px_1fr_1fr_1fr_32px] lg:items-center">
          <select
            aria-label={`Step ${index + 1} action`}
            className="h-8 rounded-md border border-[#e5e7eb] px-2 text-[12px]"
            value={step.action}
            disabled={readOnly}
            onChange={(event) => update(step.id, { action: event.target.value })}
          >
            {STEP_ACTIONS.map((action) => <option key={action}>{action}</option>)}
          </select>
          <input
            aria-label={`Step ${index + 1} target`}
            className="h-8 rounded-md border border-[#e5e7eb] px-2 text-[12px] outline-none focus:border-[#a9a1f7]"
            placeholder="Button, field or URL"
            value={step.target}
            disabled={readOnly}
            onChange={(event) => update(step.id, { target: event.target.value })}
          />
          <input
            aria-label={`Step ${index + 1} value`}
            className="h-8 rounded-md border border-[#e5e7eb] px-2 text-[12px] outline-none focus:border-[#a9a1f7]"
            placeholder="Optional value"
            value={step.value}
            disabled={readOnly}
            onChange={(event) => update(step.id, { value: event.target.value })}
          />
          <input
            aria-label={`Step ${index + 1} selector`}
            className="h-8 rounded-md border border-[#e5e7eb] px-2 font-mono text-[11.5px] outline-none focus:border-[#a9a1f7]"
            placeholder="[data-testid=…]"
            value={step.selector}
            disabled={readOnly}
            onChange={(event) => update(step.id, { selector: event.target.value })}
          />
          <button
            type="button"
            aria-label={`Remove step ${index + 1}`}
            disabled={readOnly || steps.length === 1}
            onClick={() => onChange(steps.filter((entry) => entry.id !== step.id))}
            className="flex size-8 items-center justify-center rounded-md text-[#9ca3af] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-40"
          >
            <CqaIcon name="delete" className="text-[16px]" />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={readOnly || steps.length >= 50}
        onClick={() => onChange([...steps, blankStep(steps.length + 1)])}
        className={cn(cqaBtnSecondary, "h-8 px-2.5 text-[12px]")}
      >
        <CqaIcon name="add" className="text-[15px]" /> Add step
      </button>
    </div>
  );
}

function StepGroupEditor({
  open,
  group,
  onClose,
  readOnly,
}: {
  open: boolean;
  group: ParityStepGroup | null;
  onClose: () => void;
  readOnly: boolean;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<ParityStep[]>([]);

  useEffect(() => {
    if (!group) return;
    setName(group.name);
    setDescription(group.description);
    setSteps(group.steps.length > 0 ? group.steps : [blankStep(1)]);
    setError(null);
  }, [group, setError]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!group) return;
    const usable = steps.filter((step) => step.target.trim().length > 0);
    if (usable.length === 0) {
      setError("Add at least one step with a target.");
      return;
    }
    const res = await run("sg-edit", `/api/dashboard/test-components/${group.id}`, {
      method: "PATCH",
      json: { name, description, steps: usable },
      success: `Step group "${name}" saved.`,
    });
    if (res) {
      router.refresh();
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Step Group" size="lg">
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className={cqaLabel}>Name *</span>
          <input className={cqaInput} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
        </label>
        <label className="block">
          <span className={cqaLabel}>Description</span>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional description"
          />
        </label>
        <div>
          <span className={cqaLabel}>Steps</span>
          <StepEditorList steps={steps} onChange={setSteps} readOnly={readOnly} />
        </div>
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-[#f0f1f3] pt-4">
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" className={cqaBtnPrimary} disabled={readOnly || pending === "sg-edit"}>
            {pending === "sg-edit" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FolderModal({
  state,
  folders,
  rows,
  readOnly,
  onClose,
  onDone,
}: {
  state: { mode: "create" | "rename" | "move" | "delete"; folder?: ParityFolder } | null;
  folders: ParityFolder[];
  rows: ParityTestCase[];
  readOnly: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#5b4ee8");
  const [target, setTarget] = useState("unfiled");

  useEffect(() => {
    if (!state) return;
    setName(state.folder?.name ?? "");
    setColor(state.folder?.color ?? "#5b4ee8");
    setTarget("unfiled");
    setError(null);
  }, [state, setError]);

  if (!state) return null;

  const affected = state.folder ? rows.filter((row) => row.folderId === state.folder?.id) : [];
  const title =
    state.mode === "create"
      ? "New folder"
      : state.mode === "rename"
        ? "Rename folder"
        : state.mode === "move"
          ? `Move cases out of ${state.folder?.name ?? ""}`
          : "Delete folder";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!state) return;
    if (state.mode === "create") {
      const res = await run("folder", "/api/dashboard/test-folders", {
        json: { name, color },
        success: `Folder "${name}" created.`,
      });
      if (res) onDone();
      return;
    }
    if (!state.folder) return;
    if (state.mode === "rename") {
      const res = await run("folder", `/api/dashboard/test-folders/${state.folder.id}`, {
        method: "PATCH",
        json: { name, color },
        success: `Folder renamed to "${name}".`,
      });
      if (res) onDone();
      return;
    }
    if (state.mode === "delete") {
      const res = await run("folder", `/api/dashboard/test-folders/${state.folder.id}`, {
        method: "DELETE",
        success: `Folder "${state.folder.name}" deleted.`,
      });
      if (res) onDone();
      return;
    }
    const folderId = target === "unfiled" ? null : target;
    try {
      await Promise.all(
        affected.map((row) => apiFetch(`/api/dashboard/test-cases/${row.id}`, { method: "PATCH", json: { action: "move", folderId } })),
      );
      toast(`${affected.length} test case${affected.length === 1 ? "" : "s"} moved.`, "success");
      onDone();
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form="folder-modal-form"
            disabled={readOnly || pending === "folder"}
            className={cn(
              "inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-white disabled:opacity-60",
              state.mode === "delete" ? "bg-[#dc2626] hover:bg-[#b91c1c]" : "bg-[#5b4ee8] hover:bg-[#4c3fd6]",
            )}
          >
            {pending === "folder"
              ? "Saving…"
              : state.mode === "create"
                ? "Create folder"
                : state.mode === "rename"
                  ? "Save name"
                  : state.mode === "move"
                    ? "Move cases"
                    : "Delete folder"}
          </button>
        </>
      }
    >
      <form id="folder-modal-form" onSubmit={submit} className="space-y-3">
        {state.mode === "delete" ? (
          <p className="text-[13px] text-[#4b5563]">
            Delete <strong>{state.folder?.name}</strong>? The folder is removed from SQLite. Its {affected.length} test case
            {affected.length === 1 ? "" : "s"} stay in the library and become unfiled.
          </p>
        ) : state.mode === "move" ? (
          <>
            <p className="text-[13px] text-[#4b5563]">
              Move all <strong>{affected.length}</strong> test case{affected.length === 1 ? "" : "s"} inside{" "}
              <strong>{state.folder?.name}</strong> to another folder.
            </p>
            <label className="block">
              <span className={cqaLabel}>Destination</span>
              <select className={cqaInput} value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="unfiled">Unfiled</option>
                {folders.filter((folder) => folder.id !== state.folder?.id).map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="block">
              <span className={cqaLabel}>Folder name *</span>
              <input className={cqaInput} value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={60} placeholder="e.g. Checkout regression" />
            </label>
            <label className="block">
              <span className={cqaLabel}>Colour</span>
              <div className="flex items-center gap-2">
                <input type="color" aria-label="Folder colour" value={color} onChange={(event) => setColor(event.target.value)} className="h-9 w-14 cursor-pointer rounded border border-[#e5e7eb] bg-white p-1" />
                <span className="text-[12px] text-[#6b7280]">{color}</span>
              </div>
            </label>
          </>
        )}
        {error && <p className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
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
  const [steps, setSteps] = useState<ParityStep[]>([blankStep(1)]);

  function addLabel() {
    const next = labelDraft.trim();
    if (!next || labels.includes(next)) return;
    setLabels((prev) => [...prev, next]);
    setLabelDraft("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const usableSteps = steps.filter((step) => step.target.trim().length > 0);
    if (usableSteps.length === 0) {
      setError("Add at least one step with a target.");
      return;
    }
    const res = await run("sg", "/api/dashboard/test-components", {
      json: { name, description, steps: usableSteps },
      success: `Step group "${name}" created.`,
    });
    if (res) {
      setName("");
      setDescription("");
      setLabels([]);
      setSelectedPrereqs([]);
      setStatus("Any");
      setSteps([blankStep(1)]);
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

        <div>
          <span className={cqaLabel}>Steps *</span>
          <StepEditorList steps={steps} onChange={setSteps} readOnly={readOnly} />
        </div>

        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-[#f0f1f3] pt-4">
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" className={cqaBtnPrimary} disabled={readOnly || pending === "sg"}>
            {pending === "sg" ? "CreatingÔÇª" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
