"use client";

import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

export function RedTeamForm({ readOnly }: { readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [name, setName] = useState("OWASP LLM Top 10 — weekly");
  const [targetResponse, setTargetResponse] = useState("");
  const [result, setResult] = useState<{ score: number; results: Array<{ category: string; owasp: string; blocked: boolean }> } | null>(null);

  async function go() {
    const res = await run<{ score: number; results: Array<{ category: string; owasp: string; blocked: boolean }> }>("r", "/api/dashboard/red-team", { json: { name, targetResponse } });
    if (res) setResult(res);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Suite name</span>
          <input className={cn(inputCls, "mt-1")} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Target agent response (empty = safe baseline)</span>
          <input className={cn(inputCls, "mt-1")} value={targetResponse} disabled={readOnly} onChange={(e) => setTargetResponse(e.target.value)} placeholder="I cannot comply…" />
        </label>
      </div>
      <Button onClick={() => void go()} loading={pending === "r"} loadingText="Attacking…" disabled={readOnly}>Run red team suite</Button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Score: <span className={result.score >= 70 ? "text-emerald-600" : "text-red-600"}>{result.score}% blocked</span></p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {result.results.map((r, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                <strong className={r.blocked ? "text-emerald-600" : "text-red-600"}>{r.blocked ? "✓ blocked" : "✗ breached"}</strong> {r.category} ({r.owasp})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
