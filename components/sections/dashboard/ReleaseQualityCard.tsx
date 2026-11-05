import { Badge } from "@/components/ui/Badge";
import type { RunDTO } from "@/lib/types";
import { formatUsdCompact } from "@/lib/utils";

/** Carte "Release Quality Report" de la dernière release. */
export function ReleaseQualityCard({ latest, previous, first }: { latest: RunDTO; previous: RunDTO | null; first: RunDTO }) {
  const scoreDelta = previous ? latest.qualityScore - previous.qualityScore : 0;
  const coverageGain = Math.round(latest.coverage - first.coverage);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - latest.qualityScore / 100);

  const items = [
    { value: latest.codeChanges, label: "code changes analyzed" },
    { value: latest.impactedTests, label: "impacted tests identified" },
    { value: latest.regressionsCaught, label: "regressions caught" },
    { value: latest.anomaliesReproduced, label: "production anomaly reproduced" },
    { value: latest.testsAdded, label: "regression tests added" },
  ];

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Release Quality Report</p>
          <p className="text-xs text-slate-500">
            Release {latest.release} · {latest.version}
          </p>
        </div>
        <Badge tone={latest.status === "SUCCESS" ? "success" : "danger"} dot>
          {latest.status === "SUCCESS" ? "Analyzed" : "Blocked"}
        </Badge>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <div className="relative size-28 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" className="stroke-slate-100" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              className="stroke-brand-600"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-slate-900">{latest.qualityScore}</span>
            <span className="text-[10px] text-slate-400">/ 100</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Quality score</p>
          {previous && (
            <p className={scoreDelta >= 0 ? "text-sm font-medium text-emerald-600" : "text-sm font-medium text-red-600"}>
              {scoreDelta >= 0 ? "↑" : "↓"} {Math.abs(scoreDelta)} vs. previous release
            </p>
          )}
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-baseline gap-3 text-sm">
            <span className="w-8 text-right font-semibold tabular-nums text-slate-900">{item.value}</span>
            <span className="text-slate-500">{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto rounded-lg bg-brand-50 p-4 ring-1 ring-brand-100">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Estimated defect cost avoided</p>
        <p className="mt-1 text-2xl font-semibold text-brand-800">{formatUsdCompact(latest.costAvoided)}</p>
        <p className="mt-1 text-xs text-brand-700/80">
          Coverage ↑ {coverageGain} pts since release {first.release} · {latest.testsPassed}/{latest.testsTotal} tests passing
        </p>
      </div>
    </div>
  );
}
