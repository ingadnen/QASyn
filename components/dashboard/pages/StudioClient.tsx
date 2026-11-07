"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface StudioStep {
  id: string;
  action: "Navigate" | "Click" | "Enter Text" | "Verify Element" | "API Call" | "AI Assertion";
  target: string;
  value: string;
  selector: string;
}

const ACTIONS: StudioStep["action"][] = ["Navigate", "Click", "Enter Text", "Verify Element", "API Call", "AI Assertion"];

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

export function StudioClient({ testCaseId, initialSteps, readOnly }: { testCaseId: string; initialSteps: StudioStep[]; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [steps, setSteps] = useState<StudioStep[]>(initialSteps.length ? initialSteps : [{ id: "s1", action: "Navigate", target: "https://example.com", value: "", selector: "" }]);
  const [log, setLog] = useState<LogLine[] | null>(null);
  const [selected, setSelected] = useState(0);

  function update(i: number, patch: Partial<StudioStep>) {
    setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function addStep() {
    setSteps((s) => [...s, { id: `s${Date.now()}`, action: "Click", target: "", value: "", selector: "" }]);
  }
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, j) => j !== i));
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
                    <button type="button" aria-label="Remove step" className="rounded p-1 text-slate-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); removeStep(i); }}>
                      ✕
                    </button>
                  )}
                </div>
                {line && <p className="mt-1 pl-8 text-xs text-slate-500">{line.message}</p>}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <>
              <Button variant="secondary" onClick={addStep}>+ Add step</Button>
              <Button variant="secondary" onClick={() => void save()} loading={pending === "save"} loadingText="Saving…">Save steps</Button>
            </>
          )}
          <Button onClick={() => void runSteps()} loading={pending === "run"} loadingText="Running…" disabled={readOnly || steps.length === 0}>
            ▶ Run Test
          </Button>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {log && (
          <pre className="max-h-64 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-200">
            {log.map((l) => `[step ${l.step}] ${l.action} ${l.target} → ${l.status}${l.healed ? " (AI auto-healing: selector updated)" : ""}`).join("\n")}
          </pre>
        )}
      </div>

      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
      </aside>
    </div>
  );
}
