"use client";

import { useMemo, useState } from "react";
import { CreateCollectionButton } from "@/components/dashboard/pages/CreateCollectionButton";
import { CqaIcon, cqaCard } from "@/components/dashboard/ui";
import { PageActions, RowMenu, TableShell, Td, Tr } from "@/components/contextqa/workspace";
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
  const [view, setView] = useState<"list" | "modular">("list");
  const [query, setQuery] = useState("");
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suites;
    return suites.filter((suite) => suite.name.toLowerCase().includes(q) || suite.module.toLowerCase().includes(q));
  }, [suites, query]);

  const folders = useMemo(() => {
    const map = new Map<string, SuiteRow[]>();
    for (const suite of filtered) {
      const key = suite.module.trim() || "Unorganised";
      map.set(key, [...(map.get(key) ?? []), suite]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search suites"
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
          />
        </div>
        <PageActions
          filter
          primary={
            <CreateCollectionButton kind="suites" readOnly={readOnly} label="Create Test Suite" defaultEmail={defaultEmail} />
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-[12.5px]">
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5",
              view === "list" ? "bg-[#f3f4f6] font-medium text-[#111827]" : "text-[#6b7280] hover:bg-[#f9fafb]",
            )}
          >
            <CqaIcon name="view_list" className="text-[17px]" /> List
          </button>
          <button
            type="button"
            onClick={() => setView("modular")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5",
              view === "modular" ? "bg-[#f3f4f6] font-medium text-[#111827]" : "text-[#6b7280] hover:bg-[#f9fafb]",
            )}
          >
            <CqaIcon name="folder" className="text-[17px]" /> Modular
          </button>
        </div>
        <span className="text-[12px] text-[#6b7280]">{filtered.length} of {suites.length} suites</span>
      </div>

      {view === "modular" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {folders.length === 0 && (
            <div className={cn(cqaCard, "col-span-full px-5 py-14 text-center")}>
              <p className="text-[14px] font-medium text-[#374151]">No data available</p>
              <p className="mt-1 text-[12.5px] text-[#9ca3af]">Create a suite to group test cases that run together.</p>
            </div>
          )}
          {folders.map(([folder, rows]) => (
            <div key={folder} className={cn(cqaCard, "overflow-hidden")}>
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
                        <a href={`/dashboard/plans/suites/${suite.id}`} className="block truncate text-[12.5px] font-medium text-[#1f2937] hover:text-[#5b4ee8]">
                          {suite.name}
                        </a>
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
        <TableShell
          headers={["", "Suite Name", "Platform", "Test Cases", "Latest Result", "Created Date", "Modified", "Folder", "Action"]}
          footer={<span className="tabular-nums">1–{filtered.length} of {filtered.length}</span>}
        >
          {filtered.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-14 text-center">
                <p className="text-[14px] font-medium text-[#374151]">No test suites yet</p>
                <p className="mt-1 text-[12.5px] text-[#9ca3af]">Create a suite to group test cases that run together.</p>
              </td>
            </tr>
          )}
          {filtered.map((suite, index) => {
            const result = liveResult(suite);
            return (
              <Tr key={suite.id}>
                <Td className="w-8 pr-0">
                  <input type="checkbox" aria-label={`Select ${suite.name}`} className="size-3.5 accent-[#5b4ee8]" />
                </Td>
                <Td>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-[10px] font-medium text-[#9ca3af]">TS-{filtered.length - index}</span>
                    <a href={`/dashboard/plans/suites/${suite.id}`} className="font-medium text-[#1f2937] hover:text-[#5b4ee8]">
                      {suite.name}
                    </a>
                  </div>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 text-[#4b5563]">
                    <CqaIcon
                      name={suite.platform === "Mobile" ? "smartphone" : suite.platform === "API" ? "api" : "desktop_windows"}
                      className="text-[15px] text-[#6b7280]"
                    />
                    {suite.platform}
                  </span>
                </Td>
                <Td className="font-medium text-[#374151]">{suite.testCasesCount}</Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#4b5563]">
                    <CqaIcon name={resultIcon(result)} className="text-[16px]" />
                    {result}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-[#6b7280]">{formatDate(suite.createdAt)}</Td>
                <Td className="whitespace-nowrap text-[#6b7280]">{formatDate(suite.lastRunAt ?? suite.createdAt)}</Td>
                <Td className="text-[#6b7280]">{suite.module || "Unorganised"}</Td>
                <Td>
                  <RowMenu
                    items={[
                      { label: "Edit", icon: "edit", href: `/dashboard/plans/suites/${suite.id}` },
                      { label: "Clone suite", icon: "content_copy" },
                      { label: "Delete suite", icon: "delete", danger: true },
                    ]}
                  />
                </Td>
              </Tr>
            );
          })}
        </TableShell>
      )}
    </>
  );
}
