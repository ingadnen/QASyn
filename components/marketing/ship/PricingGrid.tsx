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

/** Grille tarifaire + estimateur de crédits (le plan recommandé est mis en avant). */
export function PricingGrid() {
  const [usage, setUsage] = useState<UsageEstimate>({ runs: 450, steps: 30, prs: 5, bugs: 10 });
  const credits = useMemo(() => estimateCredits(usage), [usage]);
  const { plan: recommended, monthly } = useMemo(() => recommendPlan(credits), [credits]);

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <div className="rounded-[15px] border border-paper-line bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-paper-muted">Estimate your usage</p>
        <div className="mt-5 space-y-5">
          {SLIDERS.map((s) => (
            <label key={s.key} className="block">
              <span className="flex justify-between text-sm">
                <span className="text-paper-ink">{s.label}</span>
                <span className="font-semibold tabular-nums text-paper-ink">{usage[s.key].toLocaleString("en-US")}</span>
              </span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={usage[s.key]}
                onChange={(e) => setUsage((u) => ({ ...u, [s.key]: Number(e.target.value) }))}
                className="mt-2 w-full accent-ember-500"
              />
            </label>
          ))}
        </div>
        <div className="mt-6 rounded-[10px] bg-paper p-4">
          <p className="text-sm text-paper-muted">Estimated credits</p>
          <p className="font-caslon text-3xl text-paper-ink">{credits.toLocaleString("en-US")}</p>
          <p className="mt-2 text-sm text-paper-ink">
            Best fit: <strong>{recommended.name}</strong>
            {monthly !== null && <> · ≈ {usd(monthly)}/mo</>}
          </p>
          <p className="mt-1 text-xs text-paper-muted">Extra credits billed at ${CREDIT_PRICE_USD} each.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const highlighted = plan.id === recommended.id;
          return (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-[15px] border p-5 transition",
                highlighted ? "border-ember-500 bg-white shadow-xl shadow-ember-500/10" : "border-paper-line bg-paper-card/60",
              )}
            >
              {highlighted && (
                <span className="absolute -top-3 left-5 rounded-full bg-ember-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                  Recommended
                </span>
              )}
              <h3 className="font-caslon text-xl text-paper-ink">{plan.name}</h3>
              <p className="mt-1 min-h-10 text-sm text-paper-muted">{plan.blurb}</p>
              <p className="mt-4">
                <span className="font-caslon text-4xl text-paper-ink">{plan.price === null ? "Custom" : usd(plan.price)}</span>
                <span className="ml-1 text-sm text-paper-muted">{plan.period}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-paper-ink">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-ember-500" aria-hidden="true">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={cn(
                  "mt-6 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition",
                  highlighted ? "bg-ember-500 text-white hover:bg-ember-600" : "bg-paper-ink text-white hover:bg-black",
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
