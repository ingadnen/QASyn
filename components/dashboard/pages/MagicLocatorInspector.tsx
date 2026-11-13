"use client";

import { useEffect, useState } from "react";
import { CqaIcon, cqaBtnPrimary, cqaBtnSecondary } from "@/components/dashboard/ui";
import type { LocatorCandidate, MagicLocatorResult } from "@/lib/magic-locator";
import { cn } from "@/lib/utils";

interface Props {
  step: { action: string; target: string; value: string; selector: string };
  readOnly: boolean;
  onApply: (selector: string) => void;
}

const STRATEGY_STYLE: Record<LocatorCandidate["strategy"], string> = {
  Role: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Test ID": "bg-sky-50 text-sky-700 border-sky-200",
  Label: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Text: "bg-amber-50 text-amber-700 border-amber-200",
  CSS: "bg-slate-50 text-slate-600 border-slate-200",
};

/** ✨ Magic UI Component & Smart Locator inspector for a Studio step. */
export function MagicLocatorInspector({ step, readOnly, onApply }: Props) {
  const [result, setResult] = useState<MagicLocatorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ strategy: string; selector: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/dashboard/magic-locator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(step),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as (MagicLocatorResult & { error?: string }) | null;
        if (!response.ok || !payload) throw new Error(payload?.error ?? `Locator engine returned ${response.status}.`);
        if (!cancelled) setResult(payload);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not analyse this locator.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step.action, step.target, step.value, step.selector]);

  return (
    <section
      data-testid="magic-locator"
      aria-label="Magic UI Component and Smart Locator"
      className="rounded-xl border border-[#ddd6fe] bg-gradient-to-br from-[#faf9ff] to-white p-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#4c3fd6]">
            <span aria-hidden="true">✨</span> Magic UI Component &amp; Smart Locator
          </p>
          <p className="mt-0.5 text-[11px] text-[#6b7280]">
            {result ? `${result.component} · ${result.intent}` : "Scores accessible, stable locators for this step."}
          </p>
        </div>
        <span className="rounded-full border border-[#ddd6fe] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#5b4ee8]">
          Magic-MCP
        </span>
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-[11.5px] text-[#6b7280]">
          <span className="size-3.5 animate-spin rounded-full border-2 border-[#8b80ff] border-t-transparent" />
          Scoring selectors…
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11.5px] text-rose-700">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-1.5">
          {result.candidates.map((candidate, index) => (
            <div
              key={`${candidate.strategy}-${candidate.selector}`}
              data-locator-strategy={candidate.strategy}
              className={cn(
                "rounded-lg border bg-white px-2.5 py-2",
                index === 0 ? "border-[#c7d2fe] shadow-[0_1px_2px_rgba(79,70,229,0.08)]" : "border-[#eef0f3]",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded border px-1.5 py-[1px] text-[10px] font-semibold", STRATEGY_STYLE[candidate.strategy])}>
                  {candidate.strategy}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-[#374151]" title={candidate.selector}>
                  {candidate.selector}
                </code>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[#eef0f3]">
                    <span
                      className={cn("block h-full rounded-full", candidate.score >= 90 ? "bg-emerald-500" : candidate.score >= 75 ? "bg-indigo-500" : "bg-amber-500")}
                      style={{ width: `${candidate.score}%` }}
                    />
                  </span>
                  <span className="w-8 text-right text-[10.5px] font-semibold text-[#374151]">{candidate.score}</span>
                </span>
              </div>
              <p className="mt-1 text-[10.5px] leading-4 text-[#6b7280]">{candidate.reason}</p>
              {index === 0 && result.bivia && (
                <p
                  data-testid="bivia-calibrated-locator"
                  data-calibrated-probability={result.bivia.probabilityPct.toFixed(1)}
                  className={cn(
                    "mt-1 inline-flex flex-wrap items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    result.bivia.status === "answered"
                      ? "border-[#abefc6] bg-[#ecfdf3] text-[#067647]"
                      : "border-[#fedf89] bg-[#fffaeb] text-[#b54708]",
                  )}
                >
                  🧠 Verified by QASyn Vision AI · {result.bivia.probabilityPct.toFixed(1)}%
                  {result.bivia.status === "abstained" ? " · abstained" : ""}
                  {result.bivia.abstainReason ? ` · ${result.bivia.abstainReason}` : ""}
                </p>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-[#9ca3af]">
              {applied?.selector === step.selector ? `Applied ${applied.strategy}` : result.best ? `Best score ${result.best.score}/100` : "No candidate"}
            </p>
            <button
              type="button"
              data-testid="magic-apply"
              disabled={readOnly || !result.best}
              onClick={() => {
                if (!result.best) return;
                onApply(result.best.selector);
                setApplied({ strategy: result.best.strategy, selector: result.best.selector });
              }}
              className={cn(cqaBtnPrimary, "h-7 px-2.5 text-[11.5px]")}
            >
              <CqaIcon name="auto_fix_high" className="text-[14px]" /> Apply Best Locator
            </button>
          </div>
          <details className="pt-1">
            <summary className="cursor-pointer text-[10.5px] font-medium text-[#6b7280]">Magic guidance</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10.5px] leading-4 text-[#6b7280]">
              {result.guidance.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </details>
        </div>
      )}

      {!loading && !result && !error && (
        <button type="button" className={cn(cqaBtnSecondary, "mt-3 h-7 px-2.5 text-[11.5px]")} onClick={() => setLoading(true)}>
          Retry analysis
        </button>
      )}
    </section>
  );
}
