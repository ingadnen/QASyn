"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { InsertGroupIntoSteps } from "@/components/dashboard/pages/InsertGroupIntoSteps";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface StudioStep {
  id: string;
  action: "Navigate" | "Click" | "Enter Text" | "Verify Element" | "API Call" | "AI Assertion" | "OCR/Document Validation" | "KYC Check" | "Salesforce Workflow Steps";
  target: string;
  value: string;
  selector: string;
}

const ACTIONS: StudioStep["action"][] = ["Navigate", "Click", "Enter Text", "Verify Element", "API Call", "AI Assertion", "OCR/Document Validation", "KYC Check", "Salesforce Workflow Steps"];

/** Selenium-IDE style action catalogue (from live picker). */
const ACTION_TEMPLATES = [
  "Click on {target}",
  "Double click on {target}",
  "Check the checkbox {target}",
  "Uncheck the checkbox {target}",
  "Check the radio button {target}",
  "Verify that the URL contains {value}",
  "Press Enter/Return Key",
  "Press Esc Key",
  "Press Tab Key",
  "Press {value} Key",
  "Wait for {value} seconds",
  "Wait until {target} is visible",
  "Wait until the page title changes to {value}",
  "Store the title of current page in a variable {value}",
  "Store cookie named {value} in variable",
  "Delete all cookies from the current session",
  "Verify that an Alert is displayed",
  "Click OK button in the alert",
  "Select option by value {value} in the list {target}",
  "Select option by index {value} in the list {target}",
  "Scroll {target} into view",
  "Click on the Back button in the browser",
  "Take full page screenshot with URL",
  "Custom step: {target}",
] as const;

interface LogLine {
  step: number;
  action: string;
  target: string;
  status: string;
  healed: boolean;
  message: string;
}

const inputCls =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

/** Renders a step as a full natural-language sentence, resolving |variables| when available. */
function stepSentence(s: StudioStep, vars: Record<string, string>, orgUrl?: string): string {
  const resolve = (text: string) =>
    text.replace(/\|([\w.-]+)\|/g, (_, key: string) => vars[key] || (key === "url" ? orgUrl || "" : "") || `|${key}|`);
  const raw = resolve((s.target || "").trim());
  if (raw && /^(navigate|go to|verify|click|double click|enter|type|press|wait|scroll|select|check|uncheck|store|delete|take|custom)/i.test(raw)) {
    return raw;
  }
  switch (s.action) {
    case "Navigate":
      return `Navigate to ${raw || orgUrl || "the application"}`;
    case "Click":
      return `Click on ${raw || "the target element"}`;
    case "Enter Text":
      return `Enter "${resolve(s.value) || "text"}" in ${raw || "the input field"}`;
    case "Verify Element":
      return `Verify that ${raw || "the target"} is visible`;
    case "AI Assertion":
      return `AI Verification: ${raw || "the expected state is visible"}`;
    default:
      return raw || `${s.action} step`;
  }
}

export function StudioClient({
  testCaseId,
  initialSteps,
  initialVariables,
  readOnly,
  cases,
  orgUrl,
}: {
  testCaseId: string;
  initialSteps: StudioStep[];
  initialVariables?: Record<string, string>;
  readOnly: boolean;
  cases?: Array<{ id: string; title: string }>;
  orgUrl?: string;
}) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [steps, setSteps] = useState<StudioStep[]>(
    initialSteps.length ? initialSteps : [{ id: "s1", action: "Navigate", target: orgUrl ? `Navigate to ${orgUrl}` : "", value: "", selector: "" }],
  );
  const [log, setLog] = useState<LogLine[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [detailOpen, setDetailOpen] = useState<Set<number>>(new Set());
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>(initialVariables ?? {});
  const [varKey, setVarKey] = useState("");
  const [varValue, setVarValue] = useState("");
  const [template, setTemplate] = useState<string>(ACTION_TEMPLATES[0]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function update(i: number, patch: Partial<StudioStep>) {
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function addStep() {
    setSteps((s) => [...s, { id: `s${Date.now()}`, action: "Click", target: "", value: "", selector: "" }]);
  }
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, j) => j !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setSteps((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSelected((s) => Math.max(0, Math.min(steps.length - 1, s + dir)));
  }
  function dropStep(i: number) {
    if (dragIndex === null || dragIndex === i) return;
    setSteps((s) => {
      const next = [...s];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setSelected(i);
    setDragIndex(null);
  }
  async function save() {
    const res = await run("save", `/api/dashboard/test-cases/${testCaseId}`, { method: "PATCH", json: { action: "steps", steps } });
    if (res) router.refresh();
  }
  async function runSteps() {
    await save();
    const res = await run<{ log: LogLine[] }>("run", `/api/dashboard/test-cases/${testCaseId}`, { method: "PATCH", json: { action: "run_steps" } });
    if (res?.log) setLog(res.log);
    router.refresh();
  }
  const runRef = useRef(runSteps);
  runRef.current = runSteps;

  useEffect(() => {
    const handler = () => void runRef.current();
    window.addEventListener("qasyn:studio-run", handler);
    return () => window.removeEventListener("qasyn:studio-run", handler);
  }, []);

  async function saveVariables(next: Record<string, string>) {
    setVariables(next);
    await run("vars", `/api/dashboard/test-cases/${testCaseId}`, { method: "PATCH", json: { action: "variables", variables: next } });
  }

  const current = steps[selected];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <ol className="space-y-2">
          {steps.map((s, i) => {
            const line = log?.[i];
            return (
              <li
                key={s.id}
                draggable={!readOnly}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropStep(i)}
                onClick={() => setSelected(i)}
                className={cn(
                  "cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition",
                  i === selected ? "border-brand-400 ring-4 ring-brand-100" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden="true" title="Drag to reorder" className="cursor-grab select-none text-base leading-none text-slate-300 active:cursor-grabbing">⠿</span>
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
                  <span className={cn("min-w-0 flex-1 text-sm", line ? "text-slate-500" : "text-slate-800")}>{stepSentence(s, variables, orgUrl)}</span>
                  {line && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", line.healed ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                      {line.healed ? "🩹 auto-healed" : "✓ passed"}
                    </span>
                  )}
                  {!readOnly && (
                    <span className="flex items-center gap-0.5">
                      <button type="button" aria-label="Move up" className="rounded p-1 text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); moveStep(i, -1); }}>↑</button>
                      <button type="button" aria-label="Move down" className="rounded p-1 text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); moveStep(i, 1); }}>↓</button>
                      <button type="button" aria-label="Remove step" className="rounded p-1 text-slate-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); removeStep(i); }}>
                        ✕
                      </button>
                    </span>
                  )}
                </div>
                {line && <p className="mt-1 pl-12 text-xs text-slate-500">{line.message}</p>}
                <div className="mt-1 pl-12">
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-600 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = new Set(detailOpen);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      setDetailOpen(next);
                    }}
                  >
                    {detailOpen.has(i) ? "Hide Details" : "View Details"}
                  </button>
                  {detailOpen.has(i) && (
                    <div className="mt-2 space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-600">
                      <p><span className="font-semibold text-slate-700">Step {i + 1}</span> · {s.action}</p>
                      <p><span className="text-slate-400">Target:</span> {stepSentence(s, variables, orgUrl)}</p>
                      <p><span className="text-slate-400">Selector:</span> <code>{s.selector || "auto-resolved by AI"}</code></p>
                      <p><span className="text-slate-400">Value:</span> <code>{s.value || "—"}</code></p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <select aria-label="Add step from template" value={template} onChange={(e) => setTemplate(e.target.value)} className="h-9 max-w-72 rounded-lg border border-slate-200 px-2 text-sm">
                {ACTION_TEMPLATES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <InsertGroupIntoSteps
                steps={steps}
                readOnly={readOnly}
                onInsert={(groupSteps) =>
                  setSteps([
                    ...steps,
                    ...groupSteps.map((s, i) => ({
                      ...s,
                      id: s.id || `grp-${Date.now()}-${i}`,
                      action: (s.action || "Click") as StudioStep["action"],
                    })),
                  ])
                }
              />
              <Button
                variant="secondary"
                onClick={() =>
                  setSteps((s) => [
                    ...s,
                    {
                      id: `s${Date.now()}`,
                      action: template.startsWith("Navigate") || template.startsWith("Visit") ? "Navigate" : template.startsWith("Verify") || template.startsWith("Wait") ? "Verify Element" : template.includes("Enter") || template.includes("Store") ? "Enter Text" : template.includes("Select") ? "Click" : "Click",
                      target: template.replace(/\{(target|value)\}/g, "label").replace("{target}", "label"),
                      value: "",
                      selector: "",
                    },
                  ])
                }
              >
                + Add Step
              </Button>
              <Button variant="secondary" onClick={() => void save()} loading={pending === "save"} loadingText="Saving…">Save steps</Button>
            </>
          )}
          <Button
            variant="secondary"
            disabled={readOnly}
            onClick={() => setAiOpen((v) => !v)}
            loading={pending === "ai"}
          >
            ✨ AI Custom Prompt
          </Button>
          {aiOpen && (
            <div className="w-full rounded-xl border border-brand-200 bg-brand-50 p-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Describe the steps to add (e.g. “verify the welcome banner and click onboarding”)</span>
                <input className={cn(inputCls, "mt-1")} value={aiPrompt} disabled={readOnly} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Verify the welcome banner, click Get started…" />
              </label>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  disabled={readOnly || !aiPrompt.trim()}
                  onClick={async () => {
                    const parts = aiPrompt.split(/[.,]/).map((p) => p.trim()).filter(Boolean).slice(0, 4);
                    const generated: StudioStep[] = parts.map((p, i) => ({
                      id: `ai-${Date.now()}-${i}`,
                      action: /verify|check/i.test(p) ? "Verify Element" : /enter|type/i.test(p) ? "Enter Text" : "Click",
                      target: p,
                      value: "",
                      selector: "",
                    }));
                    if (generated.length === 0) return;
                    const next = [...steps, ...generated];
                    setSteps(next);
                    await run("save", `/api/dashboard/test-cases/${testCaseId}`, { method: "PATCH", json: { action: "steps", steps: next } });
                    setAiOpen(false);
                    setAiPrompt("");
                    router.refresh();
                  }}
                >
                  Generate & add {aiPrompt ? `${aiPrompt.split(/[.,]/).filter(Boolean).length} steps` : "steps"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAiOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {log && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Execution result</h2>
              <span className="text-xs text-slate-500">
                {log.filter((l) => l.status === "passed").length}/{log.length} passed
                {log.some((l) => l.healed) ? ` · ${log.filter((l) => l.healed).length} auto-healed` : ""}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {log.map((l) => (
                <li key={l.step} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={l.status === "passed" ? "text-emerald-600" : "text-red-600"}>{l.status === "passed" ? "✓" : "✕"}</span>
                  <span className="font-medium">Step {l.step}</span>
                  <span className="min-w-0 flex-1 truncate">{l.action} {l.target}</span>
                  <span className="text-slate-400">{l.healed ? "auto-healed" : l.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <aside className="h-fit space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Step inspector</h2>
        {current ? (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Action (NLP)</span>
              <select className={inputCls} value={current.action} disabled={readOnly} onChange={(e) => update(selected, { action: e.target.value as StudioStep["action"] })}>
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Target / natural language</span>
              <input className={inputCls} value={current.target} disabled={readOnly} onChange={(e) => update(selected, { target: e.target.value })} placeholder="Go to the checkout page" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Value (text to enter / expected)</span>
              <input className={inputCls} value={current.value} disabled={readOnly} onChange={(e) => update(selected, { value: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Selector (auto-filled by AI)</span>
              <input className={inputCls} value={current.selector} disabled={readOnly} onChange={(e) => update(selected, { selector: e.target.value })} placeholder="css: button.pay" />
            </label>
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
              AI auto-healing: if this selector breaks, the engine re-resolves the target from the page and heals the step during execution.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Select a step.</p>
        )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Test Case Variables</h2>
          <p className="mt-1 text-xs text-slate-500">Use <code>{"|var|"}</code> in steps.</p>
          <ul className="mt-2 space-y-1">
            {Object.entries(variables).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2 text-xs">
                <code className="rounded bg-slate-100 px-1.5 py-0.5">{k}</code>
                <span className="flex-1 truncate text-slate-600">{v}</span>
                <button type="button" className="text-slate-400 hover:text-red-600" disabled={readOnly} onClick={() => void saveVariables(Object.fromEntries(Object.entries(variables).filter(([key]) => key !== k)))}>✕</button>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className={cn(inputCls, "h-9")} placeholder="key (url, email…)" value={varKey} disabled={readOnly} onChange={(e) => setVarKey(e.target.value)} />
            <input className={cn(inputCls, "h-9")} placeholder="value" value={varValue} disabled={readOnly} onChange={(e) => setVarValue(e.target.value)} />
            <Button
              size="sm"
              disabled={readOnly || !varKey}
              onClick={async () => {
                const next = { ...variables, [varKey]: varValue };
                setVarKey("");
                setVarValue("");
                await saveVariables(next);
              }}
            >
              Add
            </Button>
          </div>
          {pending === "vars" && <p className="mt-1 text-xs text-slate-400">Saving…</p>}
        </div>
      </aside>
    </div>
  );
}
