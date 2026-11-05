import type { RunDTO } from "@/lib/types";
import { cn, formatUsdCompact } from "@/lib/utils";

interface Totals {
  runs: number;
  failedRuns: number;
  avgCoverage: number;
  costAvoided: number;
  regressionsCaught: number;
  anomaliesReproduced: number;
  testsAdded: number;
  passRate: number;
}

function Delta({ value, suffix = "", invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  if (!Number.isFinite(value) || value === 0) return <span className="text-xs text-slate-400">no change</span>;
  const positive = invert ? value < 0 : value > 0;
  return (
    <span className={cn("text-xs font-medium", positive ? "text-emerald-600" : "text-red-600")}>
      {value > 0 ? "↑" : "↓"} {Math.abs(Math.round(value * 10) / 10)}
      {suffix} vs. previous
    </span>
  );
}

/** 4 cartes de statistiques (lues depuis TestRun). */
export function StatCards({ latest, previous, totals }: { latest: RunDTO; previous: RunDTO | null; totals: Totals }) {
  const cards = [
    {
      label: "Quality score",
      value: `${latest.qualityScore}`,
      unit: "/100",
      footer: previous ? <Delta value={latest.qualityScore - previous.qualityScore} /> : null,
    },
    {
      label: "Change-to-test coverage",
      value: `${latest.coverage}`,
      unit: "%",
      footer: previous ? <Delta value={latest.coverage - previous.coverage} suffix=" pts" /> : null,
    },
    {
      label: "Regressions caught",
      value: `${totals.regressionsCaught}`,
      unit: "",
      footer: (
        <span className="text-xs text-slate-500">
          across {totals.runs} releases · {totals.testsAdded} tests added
        </span>
      ),
    },
    {
      label: "Defect cost avoided",
      value: formatUsdCompact(totals.costAvoided),
      unit: "",
      footer: <span className="text-xs text-slate-500">{formatUsdCompact(latest.costAvoided)} this release</span>,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{card.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {card.value}
            <span className="text-base font-medium text-slate-400">{card.unit}</span>
          </p>
          <div className="mt-2">{card.footer}</div>
        </div>
      ))}
    </div>
  );
}
