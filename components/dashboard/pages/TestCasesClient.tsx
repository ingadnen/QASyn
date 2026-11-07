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
  const [tab, setTab] = useState<"cases" | "groups">("cases");
  const [view, setView] = useState<"list" | "modular">("list");
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

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          label="Library"
          value={tab}
          onChange={setTab}
          options={[
            { value: "cases", label: "Test Cases" },
            { value: "groups", label: "Step Groups" },
          ]}
        />
        <Tabs
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "List" },
            { value: "modular", label: "Modular" },
          ]}
        />
      </div>

      {tab === "groups" ? (
        <Card>
          <EmptyState
            title="No step groups yet"
            description="Reusable step sub-routines live here. Create one in Test Components, or convert a recorded flow."
            action={<a href="/dashboard/test-studio" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500">Open Test Studio</a>}
          />
        </Card>
      ) : view === "modular" ? (
        <Card>
          <div className="p-5">
            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Folders · Organized</p>
            <ul className="mt-3 space-y-2">
              {modules.map((m) => {
                const inModule = rows.filter((r) => r.module === m);
                return (
                  <li key={m}>
                    <Link href={`/dashboard/test-cases`} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm hover:border-slate-300">
                      <span className="font-medium capitalize text-slate-800">{m}</span>
                      <span className="text-xs text-slate-500">{inModule.length} test{inModule.length === 1 ? "" : "s"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-semibold tracking-widest text-slate-400 uppercase">Unorganized</summary>
              <p className="mt-2 text-xs text-slate-500">No Test Case in This Folder.</p>
            </details>
          </div>
        </Card>
      ) : (
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
                  <th className={tableCls.th}>Type</th>
                  <th className={tableCls.th}>Priority</th>
                  <th className={tableCls.th}>Result</th>
                  <th className={tableCls.th}>Status</th>
                  <th className={tableCls.th}>Module</th>
                  <th className={tableCls.th}>Folder</th>
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
                    <td className={tableCls.td}>
                      <span className="text-xs text-slate-500">language · Browser</span>
                    </td>
                    <td className={tableCls.td}>
                      <StatusPill value={r.criticality} />
                    </td>
                    <td className={`${tableCls.td} text-xs ${r.status === "passing" ? "text-emerald-600" : r.status === "failing" ? "text-red-600" : "text-amber-600"}`}>
                      {r.status === "passing" ? "Passed" : r.status === "failing" ? "Test Needs Update" : "Test Data Issue"}
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
                    <td className={`${tableCls.td} capitalize`}>{r.module}</td>
                    <td className={`${tableCls.td} capitalize text-slate-600`}>{r.module}</td>
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
      )}

      <NewTestCasesModal open={modalOpen} onClose={() => setModalOpen(false)} modules={modules} onCreated={(n) => setNotice(`${n} test case${n === 1 ? "" : "s"} created`)} />
    </div>
  );
}

function NewTestCasesModal({ open, onClose, modules, onCreated }: { open: boolean; onClose: () => void; modules: string[]; onCreated: (n: number) => void }) {
  const { run, pending, error, setError } = useAction();
  const [method, setMethod] = useState<"ai" | "import" | "record" | "manual">("ai");
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [module, setModule] = useState(modules[0] ?? "Core");
  const [criticality, setCriticality] = useState<Criticality>("medium");
  const [stepsCount, setSteps] = useState(3);
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState("");
  const [requirementName, setRequirementName] = useState("");
  const [count, setCount] = useState(3);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const json =
      method === "manual" ? { mode: "manual", title, module, criticality, stepsCount } : { mode: "ai", module, criticality, prompt: prompt || (url ? `Explore ${url}` : ""), count };
    const res = await run<{ created: number }>("create", "/api/dashboard/test-cases", { json });
    if (res) {
      onCreated(res.created);
      setTitle("");
      setPrompt("");
      onClose();
    }
  }

  const METHODS = [
    { id: "ai", name: "AI Assistance", blurb: "Describe your feature and let AI generate comprehensive test cases instantly." },
    { id: "import", name: "Import Files", blurb: "Upload requirements docs or test spreadsheets to extract and generate test cases." },
    { id: "record", name: "Record & Play", blurb: "Record browser interactions and automatically convert them into reusable test steps." },
    { id: "manual", name: "Create manually", blurb: "Define steps and expected results by hand." },
  ] as const;

  return (
    <Modal
      open={open}
      onClose={() => {
        setError(null);
        setStep(1);
        onClose();
      }}
      title="Create Test Case"
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">Choose the method that fits your workflow. You can always switch later.</p>
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Step {step} of 2</p>
        {step === 1 ? (
          <div className="grid gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                aria-pressed={method === m.id}
                className={`rounded-xl border p-3 text-left transition ${method === m.id ? "border-brand-500 bg-brand-50 ring-4 ring-brand-100" : "border-slate-200 hover:border-slate-300"}`}
              >
                <span className="text-sm font-semibold text-slate-900">{m.name}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{m.blurb}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {method === "ai" && (
              <>
                <Input label="Target URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://app.example.com/login" />
                <Input label="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={200} placeholder="Sign in, add a product, apply a coupon, complete checkout. Cover payment validation." />
                <Input label="Requirement name (optional)" value={requirementName} onChange={(e) => setRequirementName(e.target.value)} placeholder="Requirement name (optional)" />
              </>
            )}
            <Input label="Module" value={module} onChange={(e) => setModule(e.target.value)} list="tc-modules" required maxLength={40} />
            <datalist id="tc-modules">
              {modules.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <Select label="Priority (criticality)" value={criticality} onChange={setCriticality} options={CRITICALITIES} />
            {method === "manual" ? (
              <>
                <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={160} placeholder="User can reset their password" />
                <Input label="Steps" type="number" min={1} max={50} value={stepsCount} onChange={(e) => setSteps(Number(e.target.value) || 1)} />
              </>
            ) : (
              <Input label="How many" type="number" min={1} max={4} value={count} onChange={(e) => setCount(Math.min(4, Math.max(1, Number(e.target.value) || 1)))} hint="Costs 10 credits per generation." />
            )}
          </>
        )}
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>
              Get started →
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button type="submit" loading={pending === "create"} loadingText="Generating…">
                Create
              </Button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
