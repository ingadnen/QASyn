"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { formatDate, tableCls } from "@/lib/format";
import { CRITICALITIES, TEST_STATUSES, type Criticality, type TestStatus } from "@/lib/types";
import { Card, EmptyState, ErrorNote, Modal, ReadOnlyHint, Select, StatusPill, useAction } from "../ui";

export interface TestCaseRow {
  id: string;
  title: string;
  module: string;
  criticality: string;
  status: string;
  stepsCount: number;
  source: string;
  lastRunAt: string | null;
}

export function TestCasesClient({ rows, readOnly, openNew }: { rows: TestCaseRow[]; readOnly: boolean; openNew: boolean }) {
  const { run, pending, error } = useAction();
  const [q, setQ] = useState("");
  const [module, setModule] = useState("all");
  const [status, setStatus] = useState<"all" | TestStatus>("all");
  const [modalOpen, setModalOpen] = useState(openNew && !readOnly);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (openNew && !readOnly) setModalOpen(true);
  }, [openNew, readOnly]);
  const modules = useMemo(() => [...new Set(rows.map((r) => r.module))].sort(), [rows]);
  const filtered = rows.filter(
    (r) =>
      (module === "all" || r.module === module) &&
      (status === "all" || r.status === status) &&
      (!q || r.title.toLowerCase().includes(q.toLowerCase())),
  );

  async function runBatch() {
    const res = await run<{ passed: number; failed: number; total: number }>("batch", "/api/dashboard/test-cases/run-batch", {
      json: module === "all" ? {} : { module },
    });
    if (res) setNotice(`Ran ${res.total} test cases · ${res.passed} passed · ${res.failed} failed`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Search" placeholder="Search test cases…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
        <Select label="Module" value={module} onChange={setModule} options={["all", ...modules]} className="w-40" />
        <Select label="Status" value={status} onChange={setStatus} options={["all", ...TEST_STATUSES] as Array<"all" | TestStatus>} className="w-36" />
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" disabled={readOnly || rows.length === 0} loading={pending === "batch"} loadingText="Running…" onClick={runBatch}>
            ▶ Run {module === "all" ? "all" : module}
          </Button>
          <Button disabled={readOnly} onClick={() => setModalOpen(true)}>
            + New Test Cases
          </Button>
        </div>
      </div>
      <ReadOnlyHint readOnly={readOnly} />
      <ErrorNote error={error} />
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={rows.length ? "No test case matches these filters" : "No test cases yet"}
            description={rows.length ? undefined : "Complete a crawl, generate them with AI or write one manually."}
            action={!rows.length && !readOnly ? <Button onClick={() => setModalOpen(true)}>+ New Test Cases</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead>
                <tr>
                  <th className={tableCls.th}>Test case</th>
                  <th className={tableCls.th}>Module</th>
                  <th className={tableCls.th}>Criticality</th>
                  <th className={tableCls.th}>Status</th>
                  <th className={tableCls.th}>Last run</th>
                  <th className={tableCls.th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={tableCls.tr}>
                    <td className={tableCls.td}>
                      <Link href={`/dashboard/test-cases/${r.id}`} className="font-medium text-brand-700 hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {r.stepsCount} steps · {r.source}
                      </p>
                    </td>
                    <td className={`${tableCls.td} capitalize`}>{r.module}</td>
                    <td className={tableCls.td}>
                      <StatusPill value={r.criticality} />
                    </td>
                    <td className={tableCls.td}>
                      {readOnly ? (
                        <StatusPill value={r.status} />
                      ) : (
                        <select
                          aria-label={`Status of ${r.title}`}
                          value={r.status}
                          disabled={pending !== null}
                          onChange={(e) => run(`s-${r.id}`, `/api/dashboard/test-cases/${r.id}`, { method: "PATCH", json: { action: "set", status: e.target.value } })}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          {TEST_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className={`${tableCls.td} text-xs text-slate-500`}>{formatDate(r.lastRunAt)}</td>
                    <td className={`${tableCls.td} whitespace-nowrap text-right`}>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={readOnly}
                        loading={pending === `r-${r.id}`}
                        onClick={() => run(`r-${r.id}`, `/api/dashboard/test-cases/${r.id}`, { method: "PATCH", json: { action: "run" } })}
                      >
                        Run
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={readOnly}
                        loading={pending === `d-${r.id}`}
                        onClick={() => confirm(`Delete "${r.title}"?`) && run(`d-${r.id}`, `/api/dashboard/test-cases/${r.id}`, { method: "DELETE" })}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewTestCasesModal open={modalOpen} onClose={() => setModalOpen(false)} modules={modules} onCreated={(n) => setNotice(`${n} test case${n === 1 ? "" : "s"} created`)} />
    </div>
  );
}

function NewTestCasesModal({ open, onClose, modules, onCreated }: { open: boolean; onClose: () => void; modules: string[]; onCreated: (n: number) => void }) {
  const { run, pending, error, setError } = useAction();
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [title, setTitle] = useState("");
  const [module, setModule] = useState(modules[0] ?? "Core");
  const [criticality, setCriticality] = useState<Criticality>("medium");
  const [stepsCount, setSteps] = useState(3);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(3);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const json =
      mode === "manual" ? { mode, title, module, criticality, stepsCount } : { mode, module, criticality, prompt, count };
    const res = await run<{ created: number }>("create", "/api/dashboard/test-cases", { json });
    if (res) {
      onCreated(res.created);
      setTitle("");
      setPrompt("");
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="New test cases"
    >
      <form onSubmit={submit} className="space-y-4">
        <Tabs
          label="Creation mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "ai", label: "Generate with AI" },
            { value: "manual", label: "Write manually" },
          ]}
        />
        <Input label="Module" value={module} onChange={(e) => setModule(e.target.value)} list="tc-modules" required maxLength={40} />
        <datalist id="tc-modules">
          {modules.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <Select label="Criticality" value={criticality} onChange={setCriticality} options={CRITICALITIES} />
        {mode === "manual" ? (
          <>
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={160} placeholder="User can reset their password" />
            <Input label="Steps" type="number" min={1} max={50} value={stepsCount} onChange={(e) => setSteps(Number(e.target.value) || 1)} />
          </>
        ) : (
          <>
            <Input label="Focus (optional)" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={200} placeholder="e.g. edge cases for EU customers" />
            <Input label="How many" type="number" min={1} max={4} value={count} onChange={(e) => setCount(Math.min(4, Math.max(1, Number(e.target.value) || 1)))} hint="Costs 10 credits per generation." />
          </>
        )}
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending === "create"} loadingText={mode === "ai" ? "Generating…" : "Creating…"}>
            {mode === "ai" ? "Generate" : "Create test case"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
