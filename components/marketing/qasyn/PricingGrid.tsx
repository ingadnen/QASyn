"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CREDIT_PRICE_USD, PLANS, estimateCredits, recommendPlan, type UsageEstimate } from "@/lib/marketing";
import { cn } from "@/lib/utils";

const SLIDERS: { key: keyof UsageEstimate; label: string; min: number; max: number; step: number }[] = [
  { key: "runs", label: "Test runs / month", min: 0, max: 3000, step: 50 },
  { key: "steps", label: "Avg. steps per test", min: 4, max: 60, step: 2 },
  { key: "prs", label: "PRs analysed / month", min: 0, max: 500, step: 5 },
  { key: "bugs", label: "Bugs analysed / month", min: 0, max: 300, step: 5 },
];

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Obsidian Quantum pricing grid + credit estimator (recommended plan highlighted). */
export function PricingGrid() {
  const [usage, setUsage] = useState<UsageEstimate>({ runs: 450, steps: 30, prs: 5, bugs: 10 });
  const credits = useMemo(() => estimateCredits(usage), [usage]);
  const { plan: recommended, monthly } = useMemo(() => recommendPlan(credits), [credits]);

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <div className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-quantum-300">Estimate your usage</p>
        <div className="mt-5 space-y-5">
          {SLIDERS.map((s) => (
            <label key={s.key} className="block">
              <span className="flex justify-between text-sm">
                <span className="text-slate-300">{s.label}</span>
                <span className="font-semibold tabular-nums text-white">{usage[s.key].toLocaleString("en-US")}</span>
              </span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={usage[s.key]}
                onChange={(e) => setUsage((u) => ({ ...u, [s.key]: Number(e.target.value) }))}
                className="mt-2 w-full accent-quantum-500"
              />
            </label>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-quantum-500/20 bg-gradient-to-br from-quantum-500/10 to-cobalt-500/5 p-4">
          <p className="text-sm text-slate-400">Estimated credits</p>
          <p className="font-mono text-3xl font-semibold text-white">{credits.toLocaleString("en-US")}</p>
          <p className="mt-2 text-sm text-slate-300">
            Best fit: <strong className="text-quantum-200">{recommended.name}</strong>
            {monthly !== null && <> · ≈ {usd(monthly)}/mo</>}
          </p>
          <p className="mt-1 text-xs text-slate-500">Extra credits billed at ${CREDIT_PRICE_USD} each.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const highlighted = plan.id === recommended.id;
          return (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-5 transition",
                highlighted
                  ? "border-quantum-400/60 bg-gradient-to-b from-quantum-500/10 to-cobalt-500/5 shadow-xl shadow-quantum-500/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20",
              )}
            >
              {highlighted && (
                <span className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-quantum-500 to-cobalt-400 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white shadow-lg shadow-quantum-500/30">
                  Recommended
                </span>
              )}
              <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
              <p className="mt-1 min-h-10 text-sm text-slate-400">{plan.blurb}</p>
              <p className="mt-4">
                <span className="text-4xl font-semibold tracking-tight text-white">{plan.price === null ? "Custom" : usd(plan.price)}</span>
                <span className="ml-1 text-sm text-slate-500">{plan.period}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-300">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-quantum-400" aria-hidden="true">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={cn(
                  "mt-6 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition",
                  highlighted
                    ? "bg-gradient-to-r from-quantum-500 to-cobalt-400 text-white shadow-lg shadow-quantum-500/25 hover:brightness-110"
                    : "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]",
                )}
              >
                {plan.cta}
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
