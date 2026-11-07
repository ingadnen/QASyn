"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function StudioClient({ testCaseId, initialSteps, readOnly, cases }: { testCaseId: string; initialSteps: StudioStep[]; readOnly: boolean; cases?: Array<{ id: string; title: string }> }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [steps, setSteps] = useState<StudioStep[]>(initialSteps.length ? initialSteps : [{ id: "s1", action: "Navigate", target: "https://example.com", value: "", selector: "" }]);
  const [log, setLog] = useState<LogLine[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [detailOpen, setDetailOpen] = useState<Set<number>>(new Set());
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [varKey, setVarKey] = useState("");
  const [varValue, setVarValue] = useState("");
  const [template, setTemplate] = useState<string>(ACTION_TEMPLATES[0]);

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
                onClick={() => setSelected(i)}
                className={cn(
                  "cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition",
                  i === selected ? "border-brand-400 ring-4 ring-brand-100" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{s.action}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{s.target || "—"}</span>
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
                {line && <p className="mt-1 pl-8 text-xs text-slate-500">{line.message}</p>}
                <div className="mt-1 pl-8">
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
                    View Details
                  </button>
                  {detailOpen.has(i) && (
                    <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      <p><strong>{s.action} step details</strong>: {s.action === "Navigate" ? `Navigate to ${s.target}` : s.action === "Verify Element" ? `Verify that the target "${s.target}" is visible` : s.action === "Click" ? `Click on ${s.target}` : `${s.action} on ${s.target}`}</p>
                      <p className="mt-1">Selector: <code>{s.selector || "css:body"}</code> · Value: <code>{s.value || "—"}</code></p>
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
          <Button onClick={() => void runSteps()} loading={pending === "run"} loadingText="Running…" disabled={readOnly || steps.length === 0}>
            ▶ Run Test
          </Button>
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
          <pre className="max-h-64 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-200">
            {log.map((l) => `[step ${l.step}] ${l.action} ${l.target} → ${l.status}${l.healed ? " (AI auto-healing: selector updated)" : ""}`).join("\n")}
          </pre>
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
          <p className="mt-1 text-xs text-slate-500">Use <code>{"*|var|*"}</code> in steps.</p>
          <ul className="mt-2 space-y-1">
            {Object.entries(variables).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2 text-xs">
                <code className="rounded bg-slate-100 px-1.5 py-0.5">{k}</code>
                <span className="flex-1 truncate text-slate-600">{v}</span>
                <button type="button" className="text-slate-400 hover:text-red-600" disabled={readOnly} onClick={() => setVariables(Object.fromEntries(Object.entries(variables).filter(([key]) => key !== k)))}>✕</button>
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
                setVariables(next);
                setVarKey("");
                setVarValue("");
                await run("vars", `/api/dashboard/test-cases/${testCaseId}`, { method: "PATCH", json: { action: "variables", variables: next } });
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
