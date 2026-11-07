"use client";

import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

export function EmailTestingClient({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [label, setLabel] = useState("signup flow");
  const [inboxId, setInboxId] = useState("");
  const [subject, setSubject] = useState("Your verification code");
  const [message, setMessage] = useState<{ extractedOtp?: string | null; extractedLinks?: string } | null>(null);

  async function create() {
    const res = await run<{ inbox: { id: string; emailAddress: string } }>("c", "/api/dashboard/email-testing", { json: { label } });
    if (res?.inbox) setInboxId(res.inbox.id);
  }
  async function simulate() {
    if (!inboxId) return;
    const res = await run<{ message: { extractedOtp?: string | null; extractedLinks?: string } }>("s", "/api/dashboard/email-testing", { json: { action: "simulate", inboxId, subject } });
    if (res?.message) setMessage(res.message);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Inbox label</span>
          <input className={cn(inputCls, "mt-1")} value={label} disabled={readOnly} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <Button onClick={() => void create()} loading={pending === "c"} disabled={readOnly}>Generate inbox</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Subject</span>
          <input className={cn(inputCls, "mt-1")} value={subject} disabled={readOnly} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <Button variant="secondary" onClick={() => void simulate()} loading={pending === "s"} disabled={readOnly || !inboxId}>Simulate incoming email</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          OTP extracted: <strong>{message.extractedOtp ?? "none"}</strong> · links: {message.extractedLinks ?? "[]"}
        </p>
      )}
    </div>
  );
}

export function SecurityScanForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [targetUrl, setTargetUrl] = useState("https://staging.acme.example");
  const [scanType, setScanType] = useState<"OWASP_TOP_10" | "HEADERS_SSL" | "FULL_AUDIT">("OWASP_TOP_10");
  const [result, setResult] = useState<{ cvss: number; findings: Array<{ check: string; severity: string; description: string; remediation: string }> } | null>(null);
  async function go() {
    const res = await run<{ cvss: number; findings: Array<{ check: string; severity: string; description: string; remediation: string }> }>("scan", "/api/dashboard/security-testing", { json: { targetUrl, scanType } });
    if (res) setResult(res);
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Target URL (https)</span>
          <input className={cn(inputCls, "mt-1")} value={targetUrl} disabled={readOnly} onChange={(e) => setTargetUrl(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Scan type</span>
          <select className={cn(inputCls, "mt-1")} value={scanType} disabled={readOnly} onChange={(e) => setScanType(e.target.value as typeof scanType)}>
            <option>OWASP_TOP_10</option>
            <option>HEADERS_SSL</option>
            <option>FULL_AUDIT</option>
          </select>
        </label>
        <Button onClick={() => void go()} loading={pending === "scan"} loadingText="Scanning…" disabled={readOnly}>Run OWASP scan</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">CVSS score: {result.cvss}/100 · {result.findings.length} findings</p>
          <ul className="space-y-1">
            {result.findings.map((f, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <strong>{f.severity}</strong> · {f.check} — {f.description} <span className="text-slate-500">Fix: {f.remediation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RiskForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [branchName, setBranchName] = useState("feature/checkout-v2");
  const [filesChanged, setFilesChanged] = useState(12);
  const [modulesTouched, setModulesTouched] = useState("Billing, Checkout");
  const [result, setResult] = useState<{ risk: { score: number; level: string; factors: Array<{ label: string; weight: number }> }; prioritized: Array<{ title: string; score: number }> } | null>(null);
  async function go() {
    const res = await run<{ risk: { score: number; level: string; factors: Array<{ label: string; weight: number }> }; prioritized: Array<{ title: string; score: number }> }>("risk", "/api/dashboard/risk-testing", {
      json: { branchName, filesChanged, modulesTouched: modulesTouched.split(",").map((m) => m.trim()).filter(Boolean) },
    });
    if (res) setResult(res);
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Branch</span>
          <input className={cn(inputCls, "mt-1")} value={branchName} disabled={readOnly} onChange={(e) => setBranchName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Files changed</span>
          <input className={cn(inputCls, "mt-1")} type="number" value={filesChanged} disabled={readOnly} onChange={(e) => setFilesChanged(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Modules touched (comma separated)</span>
          <input className={cn(inputCls, "mt-1")} value={modulesTouched} disabled={readOnly} onChange={(e) => setModulesTouched(e.target.value)} />
        </label>
      </div>
      <Button onClick={() => void go()} loading={pending === "risk"} loadingText="Analysing…" disabled={readOnly}>Compute risk</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Risk score: <span className={result.risk.level === "LOW" ? "text-emerald-600" : "text-red-600"}>{result.risk.score}/100 ({result.risk.level})</span></p>
          <p className="text-xs text-slate-500">Factors: {result.risk.factors.map((f) => `${f.label} ${f.weight}`).join(" · ")}</p>
          <ul className="space-y-1">
            {result.prioritized.slice(0, 5).map((p) => <li key={p.title} className="text-xs text-slate-600">#{result.prioritized.indexOf(p) + 1} {p.title} — priority {p.score}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SaasAiTest({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [copilot, setCopilot] = useState("Support copilot");
  const [prompt, setPrompt] = useState("Where is my invoice?");
  const [response, setResponse] = useState("Your latest invoice is available in Billing › History (acme.example). Let me know if you need PDF export.");
  const [result, setResult] = useState<{ passed: boolean; hallucination: { coverage: number }; drift: boolean; fallbackBehavior: string } | null>(null);
  async function go() {
    const res = await run<{ passed: boolean; hallucination: { coverage: number }; drift: boolean; fallbackBehavior: string }>("ai", "/api/dashboard/saas-ai-tools", { json: { copilot, prompt, response } });
    if (res) setResult(res);
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Copilot / chatbot</span>
          <input className={cn(inputCls, "mt-1")} value={copilot} disabled={readOnly} onChange={(e) => setCopilot(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Prompt (user)</span>
          <input className={cn(inputCls, "mt-1")} value={prompt} disabled={readOnly} onChange={(e) => setPrompt(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Response (model)</span>
          <input className={cn(inputCls, "mt-1")} value={response} disabled={readOnly} onChange={(e) => setResponse(e.target.value)} />
        </label>
      </div>
      <Button onClick={() => void go()} loading={pending === "ai"} loadingText="Evaluating…" disabled={readOnly}>Evaluate copilot</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {result && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Verdict: <strong className={result.passed ? "text-emerald-600" : "text-red-600"}>{result.passed ? "✅ passed" : "⛔ failed"}</strong> · grounding {result.hallucination.coverage}% · drift: {result.drift ? "yes" : "no"} · {result.fallbackBehavior}
        </p>
      )}
    </div>
  );
}

export function GridNodeForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [browserName, setBrowserName] = useState<"chromium" | "firefox" | "webkit" | "edge">("chromium");
  const [platform, setPlatform] = useState<"linux" | "windows" | "macos" | "android" | "ios">("linux");
  const [version, setVersion] = useState("120");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    await run("g", "/api/dashboard/infrastructure", { json: { browserName, platform, version } });
  }
  return (
    <form onSubmit={(e) => void go(e)} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Browser</span>
        <select className={cn(inputCls, "mt-1")} value={browserName} disabled={readOnly} onChange={(e) => setBrowserName(e.target.value as typeof browserName)}>
          <option value="chromium">Chromium</option>
          <option value="firefox">Firefox</option>
          <option value="webkit">WebKit (Safari)</option>
          <option value="edge">Edge</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Platform</span>
        <select className={cn(inputCls, "mt-1")} value={platform} disabled={readOnly} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
          <option value="linux">Linux</option>
          <option value="windows">Windows</option>
          <option value="macos">macOS</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Version</span>
        <input className={cn(inputCls, "mt-1")} value={version} disabled={readOnly} onChange={(e) => setVersion(e.target.value)} />
      </label>
      <Button type="submit" loading={pending === "g"} disabled={readOnly}>Register node</Button>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-4">{error}</p>}
    </form>
  );
}
