"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

// ---------------------------------------------------------- Web testing engine

export interface PlanRunResult {
  plan: { name: string; passRate: number };
  browsers: string[];
  cases: Array<{
    title: string;
    healed: number;
    log: Array<{ step: number; action: string; target: string; status: string; healed: boolean; message: string }>;
  }>;
  passRate: number;
}

export function PlanRunButton({ planId, readOnly }: { planId: string; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [result, setResult] = useState<PlanRunResult | null>(null);
  const router = useRouter();
  async function go() {
    const res = await run<PlanRunResult>("run", "/api/dashboard/test-plans/run", { json: { planId } });
    if (res) {
      setResult(res);
      router.refresh();
    }
  }
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => void go()} loading={pending === "run"} loadingText="Executing…" disabled={readOnly}>
        ▶ Run plan
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {result && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Browsers: {result.browsers.join(", ")} · Pass rate: <strong>{result.passRate}%</strong>
          </p>
          {result.cases.map((c) => (
            <details key={c.title} className="rounded-lg border border-slate-200 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {c.title} {c.healed > 0 && <span className="ml-1 text-xs font-semibold text-amber-600">🩹 {c.healed} healed</span>}
              </summary>
              <ul className="mt-2 space-y-1">
                {c.log.map((l) => (
                  <li key={l.step} className="text-xs text-slate-600">
                    [{l.step}] {l.action} {l.target} →{" "}
                    <strong className={l.healed ? "text-amber-600" : "text-emerald-600"}>{l.status.toUpperCase()}</strong> {l.healed && "🩹"} — {l.message}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------- Mobile studio

export interface GestureRow {
  id: string;
  gesture: "Tap" | "Swipe" | "Scroll" | "Enter Text" | "Pinch" | "Rotate" | "Biometric";
  target: string;
  value: string;
}

export function MobileStudio({ apps, readOnly }: { apps: Array<{ id: string; name: string; platform: string; version: string }>; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"iOS" | "Android">("Android");
  const [version, setVersion] = useState("1.0.0");
  const [fileName, setFileName] = useState("");
  const [device, setDevice] = useState("Android 14 · Pixel 8");
  const [appId, setAppId] = useState("");
  const [gestures, setGestures] = useState<GestureRow[]>([{ id: "g1", gesture: "Tap", target: "Login button", value: "" }]);
  const [log, setLog] = useState<string[] | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload() {
    const res = await run<{ app: { id: string } }>("up", "/api/dashboard/mobile/upload", {
      json: { name: name || fileName, platform, version, fileName, sizeBytes: 0 },
    });
    if (res?.app) {
      setAppId(res.app.id);
      router.refresh();
    }
  }
  async function createAndRun() {
    const created = await run<{ test: { id: string } }>("cr", "/api/dashboard/mobile/tests", {
      json: { name: name || "Mobile flow", appId: appId || undefined, device, gestures },
    });
    if (!created?.test) return;
    const res = await run<{ log: string[] }>("mr", "/api/dashboard/mobile/run", { json: { testId: created.test.id } });
    if (res?.log) setLog(res.log);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFileName(f.name);
        }}
        className={cn("rounded-xl border-2 border-dashed p-6 text-center transition", dragOver ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-white")}
      >
        <p className="text-sm font-medium text-slate-700">Drag &amp; drop your build here (APK / IPA)</p>
        <p className="mt-1 text-xs text-slate-500">or type the file name below — upload is simulated (metadata only).</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="App name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} /></Field>
        <Field label="File name"><input className={inputCls} value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder={platform === "iOS" ? "app.ipa" : "app.apk"} disabled={readOnly} /></Field>
        <Field label="Platform">
          <select className={inputCls} value={platform} disabled={readOnly} onChange={(e) => { setPlatform(e.target.value as "iOS" | "Android"); setDevice(e.target.value === "iOS" ? "iOS 17 · iPhone 15" : "Android 14 · Pixel 8"); }}>
            <option>Android</option>
            <option>iOS</option>
          </select>
        </Field>
        <Field label="Version"><input className={inputCls} value={version} onChange={(e) => setVersion(e.target.value)} disabled={readOnly} /></Field>
        <Field label="Device / OS">
          <select className={inputCls} value={device} disabled={readOnly} onChange={(e) => setDevice(e.target.value)}>
            <option>Android 14 · Pixel 8</option>
            <option>Android 11 · Galaxy A52 (API 21+)</option>
            <option>iOS 17 · iPhone 15</option>
            <option>iOS 14 · iPhone 11 (iOS 14+)</option>
          </select>
        </Field>
        <Field label="Linked app">
          <select className={inputCls} value={appId} disabled={readOnly} onChange={(e) => setAppId(e.target.value)}>
            <option value="">— none —</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>{a.name} · {a.platform} {a.version}</option>
            ))}
          </select>
        </Field>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-600">Gestures</p>
        <ul className="mt-1 space-y-2">
          {gestures.map((g, i) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
              <select
                className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
                value={g.gesture}
                disabled={readOnly}
                onChange={(e) => {
                  const v = e.target.value as GestureRow["gesture"];
                  setGestures(gestures.map((x, j) => (j === i ? { ...x, gesture: v } : x)));
                }}
              >
                {["Tap", "Swipe", "Scroll", "Enter Text", "Pinch", "Rotate", "Biometric"].map((o) => <option key={o}>{o}</option>)}
              </select>
              <input
                className="h-9 min-w-40 flex-1 rounded-lg border border-slate-200 px-2 text-sm"
                value={g.target}
                disabled={readOnly}
                placeholder="Target"
                onChange={(e) => setGestures(gestures.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))}
              />
              <input
                className="h-9 w-32 rounded-lg border border-slate-200 px-2 text-sm"
                value={g.value}
                disabled={readOnly}
                placeholder="Value (optional)"
                onChange={(e) => setGestures(gestures.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              />
              {!readOnly && <button type="button" className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => setGestures(gestures.filter((_, j) => j !== i))}>✕</button>}
            </li>
          ))}
        </ul>
        {!readOnly && <Button variant="secondary" size="sm" className="mt-2" onClick={() => setGestures([...gestures, { id: `g${Date.now()}`, gesture: "Tap", target: "", value: "" }])}>+ Add gesture</Button>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void upload()} loading={pending === "up"} loadingText="Uploading…" disabled={readOnly || !fileName}>Upload build</Button>
        <Button variant="secondary" onClick={() => void createAndRun()} loading={pending === "cr" || pending === "mr"} loadingText="Running…" disabled={readOnly}>Create &amp; run test</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {log && (
        <pre className="max-h-64 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-200">{log.join("\n")}</pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------- API testing

export interface ApiResult {
  id: string;
  method: string;
  url: string;
  status: number;
  payload: unknown;
  assertions: Array<{ kind: string; path: string; expected: string; actual: string; passed: boolean }>;
  extracted: Record<string, string>;
  ok: boolean;
}

interface ReqStep {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  protocol: "rest" | "graphql" | "soap" | "grpc";
  url: string;
  headers: Record<string, string>;
  body: string;
  assertions: Array<{ kind: "status" | "schema" | "value"; path: string; expected: string }>;
  extractionRules: Array<{ variable: string; path: string }>;
}

export function ApiTestingEditor({ testId, initial, readOnly }: { testId: string; initial: ReqStep[]; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [steps, setSteps] = useState<ReqStep[]>(initial.length ? initial.map((s) => ({ ...s, protocol: s.protocol ?? "rest" })) : [{ id: "r1", method: "POST", protocol: "rest", url: "https://jsonplaceholder.typicode.com/posts", headers: {}, body: '{"title":"qa"}', assertions: [{ kind: "status", path: "", expected: "201" }], extractionRules: [{ variable: "postId", path: "$.id" }] }]);
  const [results, setResults] = useState<ApiResult[] | null>(null);

  function update(i: number, patch: Partial<ReqStep>) {
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  async function save() {
    const res = await run("save", `/api/dashboard/api-testing/${testId}`, { method: "PATCH", json: { requests: steps } });
    if (res) router.refresh();
  }
  async function execute() {
    await save();
    const res = await run<{ results: ApiResult[] }>("exec", "/api/dashboard/api-testing/execute", { json: { testId } });
    if (res?.results) setResults(res.results);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {steps.map((s, i) => {
        const result = results?.[i];
        return (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
              <select className="h-9 rounded-lg border border-slate-200 px-2 text-sm font-semibold" value={s.method} disabled={readOnly} onChange={(e) => update(i, { method: e.target.value as ReqStep["method"] })}>
                {["GET", "POST", "PUT", "DELETE"].map((o) => <option key={o}>{o}</option>)}
              </select>
              <select className="h-9 rounded-lg border border-slate-200 px-2 text-sm" value={s.protocol} disabled={readOnly} onChange={(e) => update(i, { protocol: e.target.value as ReqStep["protocol"] })} aria-label="Protocol">
                <option value="rest">REST</option>
                <option value="graphql">GraphQL</option>
                <option value="soap">SOAP</option>
                <option value="grpc">gRPC</option>
              </select>
              <input className="h-9 min-w-56 flex-1 rounded-lg border border-slate-200 px-2 text-sm" value={s.url} disabled={readOnly} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://api.your-domain.com/…" />
              {result && (
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                  {result.status} {result.ok ? "✓" : "✗"}
                </span>
              )}
              {!readOnly && <button type="button" className="rounded p-1 text-slate-400 hover:text-red-600" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>✕</button>}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field label="Body (use {{token}} for chained variables)">
                <textarea className={cn(inputCls, "h-auto py-2")} rows={2} value={s.body} disabled={readOnly} onChange={(e) => update(i, { body: e.target.value })} />
              </Field>
              <Field label="Assertions (kind · path · expected, one per line)">
                <textarea
                  className={cn(inputCls, "h-auto py-2")}
                  rows={3}
                  disabled={readOnly}
                  value={s.assertions.map((a) => `${a.kind} · ${a.path} · ${a.expected}`).join("\n")}
                  onChange={(e) => update(i, { assertions: e.target.value.split("\n").filter(Boolean).map((line) => { const [kind, path, expected] = line.split("·").map((x) => x.trim()); return { kind: (["status", "schema", "value"].includes(kind) ? kind : "value") as ReqStep["assertions"][number]["kind"], path: path ?? "", expected: expected ?? "" }; }) })}
                />
              </Field>
              <Field label="Extraction (variable · path, one per line)">
                <textarea
                  className={cn(inputCls, "h-auto py-2")}
                  rows={2}
                  disabled={readOnly}
                  value={s.extractionRules.map((r) => `${r.variable} · ${r.path}`).join("\n")}
                  onChange={(e) => update(i, { extractionRules: e.target.value.split("\n").filter(Boolean).map((line) => { const [variable, path] = line.split("·").map((x) => x.trim()); return { variable: variable ?? "", path: path ?? "" }; }) })}
                />
              </Field>
            </div>
            {result && (
              <div className="mt-3 space-y-2">
                <ul className="space-y-1">
                  {result.assertions.map((a, j) => (
                    <li key={j} className="text-xs text-slate-600">
                      <strong className={a.passed ? "text-emerald-600" : "text-red-600"}>{a.passed ? "✓" : "✗"}</strong> {a.kind} {a.path} — expected <code>{a.expected}</code>, got <code>{a.actual}</code>
                    </li>
                  ))}
                </ul>
                <pre className="max-h-40 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-200">{JSON.stringify(result.payload, null, 2)}</pre>
                {Object.keys(result.extracted).length > 0 && <p className="text-xs text-slate-500">Extracted: {Object.entries(result.extracted).map(([k, v]) => `${k}=${v}`).join(", ")}</p>}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {!readOnly && (
          <>
            <Button variant="secondary" onClick={() => setSteps([...steps, { id: `r${Date.now()}`, method: "GET", protocol: "rest", url: "", headers: {}, body: "", assertions: [{ kind: "status", path: "", expected: "200" }], extractionRules: [] }])}>+ Add request</Button>
            <Button variant="secondary" onClick={() => void save()} loading={pending === "save"}>Save</Button>
          </>
        )}
        <Button onClick={() => void execute()} loading={pending === "exec"} loadingText="Executing…" disabled={readOnly || steps.length === 0}>▶ Execute chain</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------- Ship

export function PrImpactForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [prNumber, setPrNumber] = useState(483);
  const [branch, setBranch] = useState("fix/checkout-session");
  const [title, setTitle] = useState("Fix checkout session handling");
  const [files, setFiles] = useState("src/checkout/session.ts\nsrc/billing/retry.tsx");
  const [result, setResult] = useState<{ impact: { riskLevel: string; decision: string; scopeTitles: string[]; assessment: { modules: string[]; files: number; cases: number; reason: string } } } | null>(null);
  const router = useRouter();
  async function go() {
    const res = await run<{ impact: NonNullable<typeof result>["impact"] }>("pr", "/api/dashboard/ship/pr-impact", {
      json: { prNumber, branch, title, files: files.split("\n").map((f) => f.trim()).filter(Boolean) },
    });
    if (res?.impact) {
      setResult({ impact: res.impact });
      router.refresh();
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="PR number"><input className={inputCls} type="number" value={prNumber} disabled={readOnly} onChange={(e) => setPrNumber(Number(e.target.value))} /></Field>
        <Field label="Branch"><input className={inputCls} value={branch} disabled={readOnly} onChange={(e) => setBranch(e.target.value)} /></Field>
        <Field label="Title"><input className={inputCls} value={title} disabled={readOnly} onChange={(e) => setTitle(e.target.value)} /></Field>
      </div>
      <Field label="Changed files (one per line)">
        <textarea className={cn(inputCls, "h-auto py-2")} rows={3} value={files} disabled={readOnly} onChange={(e) => setFiles(e.target.value)} />
      </Field>
      <Button onClick={() => void go()} loading={pending === "pr"} loadingText="Analysing…" disabled={readOnly}>Analyze PR impact</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm">
            Risk: <strong>{result.impact.riskLevel}</strong> · Decision:{" "}
            <strong className={result.impact.decision === "Go" ? "text-emerald-600" : "text-red-600"}>{result.impact.decision === "Go" ? "✅ Go" : "⛔ No-Go"}</strong>
          </p>
          <p className="mt-1 text-xs text-slate-600">{result.impact.assessment.reason} Modules: {result.impact.assessment.modules.join(", ") || "—"} · {result.impact.assessment.cases} regression cases selected.</p>
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">{result.impact.scopeTitles.slice(0, 8).map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export function BugReproForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [title, setTitle] = useState("Checkout session lost after token refresh");
  const [description, setDescription] = useState("Log in\nAdd 2 items to the cart\nWait for the token to expire\nClick Pay → 401, cart emptied");
  const [result, setResult] = useState<{ rootCause: string; severity: string; testCase: { id: string } } | null>(null);
  async function go() {
    const res = await run<{ rootCause: string; severity: string; testCase: { id: string } }>("br", "/api/dashboard/ship/bug-repro", { json: { title, description } });
    if (res) {
      setResult(res);
      router.refresh();
    }
  }
  return (
    <div className="space-y-3">
      <Field label="Ticket title"><input className={inputCls} value={title} disabled={readOnly} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Description / reproduction steps (one per line)">
        <textarea className={cn(inputCls, "h-auto py-2")} rows={4} value={description} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Button onClick={() => void go()} loading={pending === "br"} loadingText="Reproducing…" disabled={readOnly}>Reproduce bug</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {result && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Severity: <strong>{result.severity}</strong> · Probable root cause: <code>{result.rootCause}</code> ·{" "}
          <a className="font-semibold underline" href={`/dashboard/test-cases/${result.testCase.id}`}>Open reproduction test →</a>
        </p>
      )}
    </div>
  );
}

export function ShipWorkflowRun({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [result, setResult] = useState<{ workflow: { decision: string; decisionReason: string | null }; stages: Array<{ stage: string; evidence: string; ok: boolean }> } | null>(null);
  async function go() {
    const res = await run("wf", "/api/dashboard/ship/workflows", { json: { name: "Autonomous Ship run" } });
    if (res) {
      setResult(res as NonNullable<typeof result>);
      router.refresh();
    }
  }
  return (
    <div className="space-y-3">
      <Button onClick={() => void go()} loading={pending === "wf"} loadingText="Running pipeline…" disabled={readOnly}>▶ Run autonomous workflow</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="space-y-2">
          <ol className="space-y-1">
            {result.stages.map((s) => (
              <li key={s.stage} className="flex items-center gap-2 text-sm text-slate-700">
                <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-white", s.ok ? "bg-emerald-500" : "bg-red-500")}>{s.ok ? "✓" : "✗"}</span>
                <strong>{s.stage}</strong> <span className="text-xs text-slate-500">{s.evidence}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm">
            Decision: <strong className={result.workflow.decision === "Go" ? "text-emerald-600" : "text-red-600"}>{result.workflow.decision === "Go" ? "✅ Go" : "⛔ No-Go"}</strong>{" "}
            <span className="text-xs text-slate-500">{result.workflow.decisionReason}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export { apiFetch };
