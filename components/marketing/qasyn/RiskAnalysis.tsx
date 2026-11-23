"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Risk = "High" | "Medium" | "Low";

interface PrRisk {
  pr: number;
  title: string;
  files: number;
  score: number;
  risk: Risk;
  areas: { name: string; impact: number; tests: string }[];
  verdict: string;
}

const PRS: PrRisk[] = [
  {
    pr: 1234,
    title: "Fix checkout session handling",
    files: 31,
    score: 78,
    risk: "High",
    areas: [
      { name: "Checkout", impact: 92, tests: "18 impacted · 2 added" },
      { name: "Payments", impact: 74, tests: "14 impacted" },
      { name: "Auth", impact: 61, tests: "15 impacted · 1 failing" },
    ],
    verdict: "3 regressions caught before merge · stale token in auth/refresh.ts:87",
  },
  {
    pr: 1228,
    title: "Speed up product listing",
    files: 28,
    score: 46,
    risk: "Medium",
    areas: [
      { name: "Catalog", impact: 70, tests: "22 impacted" },
      { name: "Search", impact: 41, tests: "11 impacted" },
      { name: "Cart", impact: 18, tests: "7 impacted" },
    ],
    verdict: "Cache warm-up hides the out-of-stock badge · test added",
  },
  {
    pr: 1209,
    title: "Improve search ranking",
    files: 19,
    score: 21,
    risk: "Low",
    areas: [
      { name: "Search", impact: 38, tests: "20 impacted" },
      { name: "Catalog", impact: 12, tests: "8 impacted" },
      { name: "Checkout", impact: 0, tests: "not affected" },
    ],
    verdict: "Safe to merge · 1 edge case covered automatically",
  },
];

const RISK_STYLE: Record<Risk, string> = {
  High: "bg-rose-50 text-rose-700 border-rose-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-brand-50 text-brand-700 border-brand-200",
};

/** Obsidian Quantum release risk analysis: blast radius per functional area. */
export function RiskAnalysis() {
  const [selected, setSelected] = useState(PRS[0]!.pr);
  const pr = PRS.find((p) => p.pr === selected) ?? PRS[0]!;

  return (
    <div className="rounded-2xl border border-pw-line bg-white p-6 shadow-sm sm:p-8">
      <div role="tablist" aria-label="Pull requests" className="flex flex-wrap gap-2">
        {PRS.map((p) => (
          <button
            key={p.pr}
            type="button"
            role="tab"
            aria-selected={p.pr === selected}
            onClick={() => setSelected(p.pr)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
              p.pr === selected
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-pw-line bg-pw-bg text-pw-muted hover:border-brand-300 hover:text-brand-700",
            )}
          >
            PR #{p.pr}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-6 grid gap-8 md:grid-cols-[1fr_1.4fr]" key={pr.pr}>
        <div className="animate-fade-in">
          <p className="text-sm text-pw-muted">{pr.files} files changed</p>
          <h3 className="mt-1 text-2xl font-semibold text-pw-heading">{pr.title}</h3>
          <div className="mt-5 flex items-end gap-3">
            <span className="text-6xl font-semibold leading-none tracking-tight text-pw-heading">{pr.score}</span>
            <span className="pb-1 text-sm text-pw-muted">/100 risk</span>
          </div>
          <span className={cn("mt-3 inline-block rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider", RISK_STYLE[pr.risk])}>
            {pr.risk} risk
          </span>
          <p className="mt-5 rounded-xl border border-pw-line bg-pw-bg p-3 text-sm text-pw-ink">{pr.verdict}</p>
        </div>
        <div className="animate-fade-in">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-pw-muted">Blast radius</p>
          <ul className="mt-4 space-y-5">
            {pr.areas.map((a) => (
              <li key={a.name}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-pw-heading">{a.name}</span>
                  <span className="text-pw-muted">{a.tests}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stitch-surface-high">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      a.impact > 65 ? "bg-gradient-to-r from-signal-rose to-signal-amber" : a.impact > 30 ? "bg-signal-amber" : "bg-emerald-400",
                    )}
                    style={{ width: `${a.impact}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
