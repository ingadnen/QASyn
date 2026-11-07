"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

export function ProjectForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"web" | "mobile" | "api">("web");
  const [baseUrl, setBaseUrl] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("p", "/api/dashboard/projects", { json: { name, type, baseUrl: baseUrl || undefined } });
    if (res) {
      setName("");
      router.refresh();
    }
  }
  return (
    <form onSubmit={(e) => void go(e)} className="grid gap-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Name</span>
        <input className={cn(inputCls, "mt-1")} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} placeholder="Storefront" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Type</span>
        <select className={cn(inputCls, "mt-1")} value={type} disabled={readOnly} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="web">web</option>
          <option value="mobile">mobile</option>
          <option value="api">api</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Base URL</span>
        <input className={cn(inputCls, "mt-1")} value={baseUrl} disabled={readOnly} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…" />
      </label>
      <Button type="submit" loading={pending === "p"} disabled={readOnly}>Create</Button>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-4">{error}</p>}
    </form>
  );
}

export function ScheduleForm({ plans, readOnly }: { plans: Array<{ id: string; name: string }>; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [testPlanId, setTestPlanId] = useState(plans[0]?.id ?? "");
  const [name, setName] = useState("Nightly regression");
  const [cron, setCron] = useState("0 2 * * *");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("s", "/api/dashboard/schedules", { json: { testPlanId, name, cronExpression: cron } });
    if (res) router.refresh();
  }
  return (
    <form onSubmit={(e) => void go(e)} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Test plan</span>
        <select className={cn(inputCls, "mt-1")} value={testPlanId} disabled={readOnly} onChange={(e) => setTestPlanId(e.target.value)}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Name</span>
        <input className={cn(inputCls, "mt-1")} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Cron (minute hour dom month dow)</span>
        <input className={cn(inputCls, "mt-1 font-mono")} value={cron} disabled={readOnly} onChange={(e) => setCron(e.target.value)} placeholder="0 2 * * *" />
      </label>
      <div className="flex items-end"><Button type="submit" loading={pending === "s"} disabled={readOnly || plans.length === 0}>Create schedule</Button></div>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
    </form>
  );
}

export function DataProfileForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [name, setName] = useState("Checkout users");
  const [csv, setCsv] = useState("username,password,currency\nalice,secret,EUR\nbob,secret2,USD");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("d", "/api/dashboard/data-profiles", { json: { name, sourceType: "csv", rows: csv } });
    if (res) router.refresh();
  }
  return (
    <form onSubmit={(e) => void go(e)} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Name</span>
        <input className={cn(inputCls, "mt-1")} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">CSV (first line = columns)</span>
        <textarea className={cn(inputCls, "mt-1 h-auto py-2 font-mono text-xs")} rows={3} value={csv} disabled={readOnly} onChange={(e) => setCsv(e.target.value)} />
      </label>
      <Button type="submit" loading={pending === "d"} disabled={readOnly}>Import</Button>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{error}</p>}
    </form>
  );
}

export function ExportForm({ cases, readOnly }: { cases: Array<{ id: string; title: string }>; readOnly: boolean }) {
  const [framework, setFramework] = useState<"playwright" | "selenium" | "cypress" | "webdriverio">("playwright");
  const [language, setLanguage] = useState<"typescript" | "javascript" | "python" | "java">("typescript");
  const [selected, setSelected] = useState<Set<string>>(new Set(cases.slice(0, 1).map((c) => c.id)));
  const [files, setFiles] = useState<Array<{ path: string; content: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ testCaseIds: [...selected], framework, language }),
      });
      const data = (await res.json()) as { files?: Array<{ path: string; content: string }>; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      setFiles(data.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Framework</span>
          <select className={cn(inputCls, "mt-1")} value={framework} onChange={(e) => setFramework(e.target.value as typeof framework)}>
            <option value="playwright">Playwright</option>
            <option value="selenium">Selenium</option>
            <option value="cypress">Cypress</option>
            <option value="webdriverio">WebdriverIO</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Language</span>
          <select className={cn(inputCls, "mt-1")} value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </label>
        <div className="flex items-end"><Button onClick={() => void go()} loading={busy} disabled={readOnly || selected.size === 0}>Generate export</Button></div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {cases.slice(0, 20).map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={selected.has(c.id)} disabled={readOnly} onChange={(e) => { const next = new Set(selected); if (e.target.checked) next.add(c.id); else next.delete(c.id); setSelected(next); }} />
            {c.title}
          </label>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {files && (
        <div className="space-y-3">
          {files.map((f) => (
            <details key={f.path} className="rounded-xl border border-slate-200">
              <summary className="cursor-pointer px-4 py-2 font-mono text-xs text-slate-800">{f.path}</summary>
              <pre className="max-h-64 overflow-auto bg-slate-900 p-4 text-[11px] text-slate-200">{f.content}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
