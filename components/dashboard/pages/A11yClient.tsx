"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { runA11yAudit } from "@/lib/accessibility-audit";
import { cn } from "@/lib/utils";

export function A11yForm() {
  const [html, setHtml] = useState('<html lang="en"><head><title>Demo</title></head><body><img src="/x.png"><input type="text"><button></button></body></html>');
  const [result, setResult] = useState<ReturnType<typeof runA11yAudit> | null>(null);
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">HTML to audit</span>
        <textarea className={cn("mt-1 h-auto w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs")} rows={5} value={html} onChange={(e) => setHtml(e.target.value)} />
      </label>
      <Button onClick={() => setResult(runA11yAudit(html))}>Run WCAG audit</Button>
      {result && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Score: <span className={result.score >= 70 ? "text-emerald-600" : "text-red-600"}>{result.score}/100</span> · {result.passed ? "✅ WCAG AA compliant" : "⛔ issues found"}</p>
          <ul className="space-y-1">
            {result.issues.map((i) => (
              <li key={i.rule} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                <strong>{i.severity}</strong> · {i.rule} (WCAG {i.wcag}) — {i.description} ×{i.count}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
