"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GraphifyMapView } from "@/components/dashboard/pages/GraphifyMap";
import { CqaIcon, StatusPill, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaIconBtn } from "@/components/dashboard/ui";
import { RowMenu } from "@/components/contextqa/workspace";
import { ColumnFilter, matchesColumnFilters } from "@/components/contextqa/table-ui";
import type { GraphifyMap } from "@/lib/graphify";
import { cn } from "@/lib/utils";

export interface DetailCase {
  id: string;
  code: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  prerequisite: string;
  variables: string;
  decision: string;
  status: string;
}

export interface RequirementDetailData {
  title: string;
  status: string;
  statusLabel: string;
  code: string;
  kind: "Crawl" | "Manual" | "Jira" | "Linear" | "Doc" | "Import";
  author: string;
  createdAt: string;
  publishMode: string;
  environment: string;
  suite: string;
  plan: string;
}

const TABS = [
  { id: "cases", label: "Test Cases" },
  { id: "questionnaire", label: "Questionnaire" },
  { id: "requirement", label: "Requirement Data" },
  { id: "graph", label: "Graphify Map" },
  { id: "history", label: "History (Coming soon)" },
  { id: "metadata", label: "Metadata" },
  { id: "gaps", label: "Gaps (Coming soon)" },
] as const;

const TYPES = ["Positive", "Negative", "Edge", "Field Validation", "End To End", "Functional", "Boundary Value"] as const;
const TYPE_LABEL: Record<string, string> = { Edge: "Edge", "End To End": "End To End", "Field Validation": "Field Validation", "Boundary Value": "Boundary Value" };

function countTypes(cases: DetailCase[]) {
  const counts = new Map<string, number>();
  for (const c of cases) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  return counts;
}

export function RequirementDetail({
  data,
  cases,
  graph,
}: {
  data: RequirementDetailData;
  cases: DetailCase[];
  graph?: GraphifyMap;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("cases");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const addFilter = (column: string) => (value: string) => setColumnFilters((current) => ({ ...current, [column]: value }));

  const counts = useMemo(() => countTypes(cases), [cases]);
  const filtered = useMemo(
    () =>
      cases.filter(
        (c) =>
          (type === "All" || c.type === type) &&
          (!query.trim() || c.title.toLowerCase().includes(query.trim().toLowerCase())) &&
          matchesColumnFilters(columnFilters, {
            "Test Case": `${c.code} ${c.title} ${c.description}`,
            Action: "Create",
            Type: c.type,
            Priority: c.priority,
            Prerequisite: c.prerequisite,
            Variables: c.variables,
            Decision: c.decision,
          }),
      ),
    [cases, type, query, columnFilters],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * size, current * size);
  const from = filtered.length === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(current * size, filtered.length);

  function exportDetail() {
    const blob = new Blob([JSON.stringify({ requirement: data, testCases: cases }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.code}-${data.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="-mt-1 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-bold leading-7 text-[#101828]">{data.title}</h1>
            <StatusPill value={data.status} label={data.statusLabel} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#4a5565]">
            <span>{data.kind}</span>
            <span className="text-[#d1d5db]">|</span>
            <span>Web</span>
            <span className="text-[#d1d5db]">|</span>
            <span>{data.code}</span>
            <span className="text-[#d1d5db]">|</span>
            <span>{data.author}</span>
            <span className="text-[#d1d5db]">|</span>
            <span>{data.createdAt}</span>
          </div>
        </div>
        <button type="button" className={cqaBtnSecondary} onClick={exportDetail}>
          <CqaIcon name="file_upload" className="text-[17px]" /> Export
        </button>
      </div>

      <div className={cn(cqaCard, "mt-5 flex flex-wrap items-stretch gap-0 overflow-hidden")}>
        <div className="flex min-w-[200px] flex-col items-center justify-center border-b border-[#f0f1f3] px-8 py-5 md:border-b-0 md:border-r">
          <p className="text-[30px] font-bold leading-9 text-[#111827]">{cases.length}</p>
          <p className="mt-1 text-[12px] font-medium text-[#6b7280]">Generated Test Cases</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4 text-[12.5px] text-[#4a5565]">
          {TYPES.filter((t) => (counts.get(t) ?? 0) > 0 || t !== "Negative").map((t) => (
            <span key={t} className="whitespace-nowrap">
              <span className="text-[#6b7280]">{TYPE_LABEL[t] ?? t}:</span>{" "}
              <span className="font-semibold text-[#111827]">{counts.get(t) ?? 0}</span>
            </span>
          ))}
        </div>
        <div className="flex shrink-0 flex-col justify-center border-t border-[#f0f1f3] px-6 py-4 text-[12.5px] text-[#4a5565] md:border-l md:border-t-0">
          <span><span className="text-[#6b7280]">All:</span> <span className="font-semibold text-[#111827]">{cases.length}</span></span>
          <span className="mt-1"><span className="text-[#6b7280]">Create:</span> <span className="font-semibold text-[#111827]">{cases.length}</span></span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-5 overflow-x-auto border-b border-[#e5e7eb]">
        {TABS.map((t) => (
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

      {tab === "cases" && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
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
            {filterOpen && (
              <select
                aria-label="Filter test case type"
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }}
                className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-2 text-[13px] text-[#374151] outline-none"
              >
                <option>All</option>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            )}
            <button type="button" aria-label="Filter" aria-pressed={filterOpen} className={cn(cqaIconBtn, "size-9 border bg-white", filterOpen ? "border-[#a9a1f7] text-[#5b4ee8]" : "border-[#e5e7eb]")} onClick={() => setFilterOpen((v) => !v)}>
              <CqaIcon name="filter_alt" className="text-[18px]" />
            </button>
          </div>

          <div className={cn(cqaCard, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#f0f1f3] bg-white">
                    <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Test Case<ColumnFilter column="Test Case" value={columnFilters["Test Case"] ?? ""} onChange={addFilter("Test Case")} /></th>
                    <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Action<ColumnFilter column="Action" value={columnFilters.Action ?? ""} onChange={addFilter("Action")} options={["Create"]} /></th>
                    <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Type<ColumnFilter column="Type" value={columnFilters.Type ?? ""} onChange={addFilter("Type")} options={[...new Set(cases.map((c) => c.type))]} /></th>
                    <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Priority<ColumnFilter column="Priority" value={columnFilters.Priority ?? ""} onChange={addFilter("Priority")} options={[...new Set(cases.map((c) => c.priority))]} /></th>
                    <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Prerequisite<ColumnFilter column="Prerequisite" value={columnFilters.Prerequisite ?? ""} onChange={addFilter("Prerequisite")} /></th>
                    <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Variables<ColumnFilter column="Variables" value={columnFilters.Variables ?? ""} onChange={addFilter("Variables")} /></th>
                    <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Decision<ColumnFilter column="Decision" value={columnFilters.Decision ?? ""} onChange={addFilter("Decision")} options={["Accepted", "Flagged"]} /></th>
                    <th className="whitespace-nowrap px-3 py-3 text-[12px] font-medium text-[#6b7280]">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] text-[#374151]">
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center">
                        <p className="text-[14px] font-medium text-[#374151]">No test cases generated</p>
                        <p className="mt-1 text-[12.5px] text-[#9ca3af]">Generated cases will appear here.</p>
                      </td>
                    </tr>
                  )}
                  {visible.map((c) => (
                    <tr key={c.id} className="border-b border-[#f3f4f6] bg-white align-top last:border-0 hover:bg-[#fafafa]">
                      <td className="max-w-[430px] px-3 py-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0 text-[10.5px] font-medium text-[#9ca3af]">{c.code}</span>
                          <div className="min-w-0">
                            <Link href={`/dashboard/test-studio/${c.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">{c.title}</Link>
                            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-[#6b7280]">{c.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="rounded border border-[#ddd6fe] bg-[#f5f3ff] px-2 py-[1px] text-[11px] font-medium text-[#5b4ee8]">Create</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[#4a5565]">{c.type}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-[#4a5565]">{c.priority}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-[#6b7280]">{c.prerequisite}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[11.5px] text-[#4a5565]">{c.variables}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={cn("rounded border px-2 py-[1px] text-[11px]", c.decision === "Accepted" ? "border-[#b9f8cf] bg-[#f0fdf4] text-[#00a63e]" : "border-[#fde68a] bg-[#fffbeb] text-[#d97706]")}>{c.decision}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <RowMenu items={[{ label: "Open in Studio", icon: "open_in_new", href: `/dashboard/test-studio/${c.id}` }, { label: "View Details", icon: "visibility", href: `/dashboard/test-studio/${c.id}` }]} />
                      </td>
                    </tr>
                  ))}
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
                <span className="tabular-nums">{from}–{to} of {filtered.length}</span>
                <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)} className="rounded p-1 hover:bg-[#f3f4f6] disabled:opacity-40"><CqaIcon name="chevron_left" className="text-[18px]" /></button>
                <button type="button" aria-label="Next page" disabled={current >= pages} onClick={() => setPage(current + 1)} className="rounded p-1 hover:bg-[#f3f4f6] disabled:opacity-40"><CqaIcon name="chevron_right" className="text-[18px]" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "questionnaire" && (
        <div className={cn(cqaCard, "mt-4 px-6 py-14 text-center")}>
          <h3 className="text-[16px] font-semibold text-[#374151]">No clarification questionnaire</h3>
          <p className="mx-auto mt-2 max-w-lg text-[13px] leading-5 text-[#6b7280]">
            Clarification questions from the AI will appear here when available. Answering them can help regenerate more specific test cases.
          </p>
        </div>
      )}

      {tab === "requirement" && (
        <div className="mt-4">
          <div className="flex items-center gap-5 border-b border-[#e5e7eb]">
            <span className="border-b-2 border-[#5b4ee8] pb-2.5 text-[13.5px] font-medium text-[#5b4ee8]">Sources &amp; Context</span>
            <span className="pb-2.5 text-[13.5px] text-[#9ca3af]">AI Analysis (Coming soon)</span>
          </div>
          <div className={cn(cqaCard, "mt-4 px-6 py-14 text-center")}>
            <h3 className="text-[16px] font-semibold text-[#374151]">No source context</h3>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-5 text-[#6b7280]">
              The AI Insight and captured activity this requirement was created from will appear here.
            </p>
          </div>
        </div>
      )}

      {tab === "graph" && (
        <div className="mt-4">
          {graph ? (
            <GraphifyMapView data={graph} />
          ) : (
            <div className={cn(cqaCard, "px-6 py-14 text-center")}>
              <h3 className="text-[16px] font-semibold text-[#374151]">Graphify Map unavailable</h3>
              <p className="mx-auto mt-2 max-w-lg text-[13px] leading-5 text-[#6b7280]">
                Run a crawl or create test cases to build the quality graph.
              </p>
            </div>
          )}
        </div>
      )}

      {(tab === "history" || tab === "gaps") && (
        <div className={cn(cqaCard, "mt-4 px-6 py-14 text-center")}>
          <h3 className="text-[16px] font-semibold text-[#374151]">{tab === "history" ? "History is coming soon" : "Gap analysis is coming soon"}</h3>
          <p className="mx-auto mt-2 max-w-lg text-[13px] leading-5 text-[#6b7280]">
            {tab === "history" ? "Changes to this requirement and its generated cases will be listed here." : "Coverage gaps across this requirement will be highlighted here."}
          </p>
        </div>
      )}

      {tab === "metadata" && (
        <div className={cn(cqaCard, "mt-4 divide-y divide-[#f0f1f3]")}>
          <div className="grid gap-4 px-5 py-4 md:grid-cols-[200px_1fr]">
            <h3 className="text-[14px] font-semibold text-[#262626]">Generation Information</h3>
            <p className="text-[13px] text-[#374151]">{data.title}</p>
          </div>
          <div className="grid gap-4 px-5 py-4 md:grid-cols-[200px_1fr]">
            <h3 className="text-[14px] font-semibold text-[#262626]">AI Insights</h3>
            <div className="space-y-1 text-[13px] text-[#374151]">
              <p>{data.kind === "Crawl" ? "Web" : data.kind}</p>
              <p>{cases.length} generated</p>
            </div>
          </div>
          <div className="grid gap-4 px-5 py-4 md:grid-cols-[200px_1fr]">
            <h3 className="text-[14px] font-semibold text-[#262626]">Version</h3>
            <p className="text-[13px] text-[#374151]">Version 1.0</p>
          </div>
          <div className="grid gap-4 px-5 py-4 md:grid-cols-[200px_1fr]">
            <h3 className="text-[14px] font-semibold text-[#262626]">Configurations</h3>
            <dl className="grid max-w-2xl grid-cols-1 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
              {[
                ["Publish Mode", data.publishMode],
                ["Environment", data.environment],
                ["Test Case Types", "Positive, Negative, Edge Case, Field Validation, Boundary Value, Functional, End To End"],
                ["Test Suite", data.suite],
                ["Test Plan", data.plan],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11.5px] font-medium uppercase tracking-wide text-[#9ca3af]">{k}</dt>
                  <dd className="mt-0.5 text-[#374151]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
