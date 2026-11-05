import type { RunDTO } from "@/lib/types";
import { formatUsdCompact } from "@/lib/utils";

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };

function xAt(i: number, n: number) {
  const inner = W - PAD.left - PAD.right;
  return n <= 1 ? PAD.left + inner / 2 : PAD.left + (i * inner) / (n - 1);
}

/** Graphique linéaire SVG : score de qualité et couverture par release. */
export function QualityTrendChart({ runs }: { runs: RunDTO[] }) {
  const min = 50;
  const yAt = (v: number) => PAD.top + ((100 - v) / (100 - min)) * (H - PAD.top - PAD.bottom);
  const series = [
    { key: "qualityScore" as const, label: "Quality score", stroke: "stroke-brand-600", fill: "fill-brand-600", dot: "bg-brand-600" },
    { key: "coverage" as const, label: "Coverage %", stroke: "stroke-emerald-500", fill: "fill-emerald-500", dot: "bg-emerald-500" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Release quality trend</p>
          <p className="text-xs text-slate-500">Last {runs.length} releases</p>
        </div>
        <div className="flex gap-4 text-xs text-slate-500">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${s.dot}`} /> {s.label}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Quality score and coverage per release">
        {[50, 60, 70, 80, 90, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yAt(v)} y2={yAt(v)} className="stroke-slate-100" />
            <text x={PAD.left - 8} y={yAt(v) + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
              {v}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.key}>
            <polyline
              fill="none"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              className={s.stroke}
              points={runs.map((r, i) => `${xAt(i, runs.length)},${yAt(r[s.key])}`).join(" ")}
            />
            {runs.map((r, i) => (
              <circle key={r.id} cx={xAt(i, runs.length)} cy={yAt(r[s.key])} r="3.5" className={`${s.fill} stroke-white`} strokeWidth="2">
                <title>{`Release ${r.release} · ${s.label}: ${r[s.key]}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {runs.map((r, i) => (
          <text key={r.id} x={xAt(i, runs.length)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
            R{r.release}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Histogramme SVG : coût de défaut évité par release. */
export function CostSavingsChart({ runs, total }: { runs: RunDTO[]; total: number }) {
  const max = Math.max(...runs.map((r) => r.costAvoided), 1);
  const inner = W - PAD.left - PAD.right;
  const slot = inner / Math.max(runs.length, 1);
  const barW = Math.min(44, slot * 0.6);
  const yAt = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Defect cost avoided</p>
          <p className="text-xs text-slate-500">Estimated per release</p>
        </div>
        <p className="text-lg font-semibold text-slate-900">{formatUsdCompact(total)}</p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Defect cost avoided per release">
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="stroke-slate-200" />
        {runs.map((r, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2;
          const y = yAt(r.costAvoided);
          const isLast = i === runs.length - 1;
          return (
            <g key={r.id}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={H - PAD.bottom - y}
                rx="5"
                className={r.status === "FAILED" ? "fill-red-300" : isLast ? "fill-brand-600" : "fill-brand-200"}
              >
                <title>{`Release ${r.release}: ${formatUsdCompact(r.costAvoided)}${r.status === "FAILED" ? " (blocked)" : ""}`}</title>
              </rect>
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {formatUsdCompact(r.costAvoided)}
              </text>
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
                R{r.release}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
