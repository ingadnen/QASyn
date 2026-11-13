"use client";

import { useState } from "react";

export function PricingCalculator() {
  const [credits, setCredits] = useState(250_000);
  const [seats, setSeats] = useState(10);
  const monthly = Math.round(credits * 0.025);
  const seatCost = Math.round(seats * 12);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5" data-testid="pricing-calculator">
      <h2 className="text-lg font-semibold text-white">Credit top-up calculator</h2>
      <p className="mt-1 text-sm text-slate-400">$0.025 per credit · volume discounts at 250K and 1M.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Credits</span>
          <input type="number" min={1000} step={1000} value={credits} onChange={(e) => setCredits(Math.max(1000, Number(e.target.value) || 0))} className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0b1120] px-3 text-sm text-white" />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Seats</span>
          <input type="number" min={1} value={seats} onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))} className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-[#0b1120] px-3 text-sm text-white" />
        </label>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-white/[0.04] px-3 py-2"><p className="text-[10.5px] uppercase tracking-wide text-slate-500">Credit purchase</p><p className="text-xl font-semibold text-white">${monthly.toLocaleString("en-US")}</p></div>
        <div className="rounded-lg bg-white/[0.04] px-3 py-2"><p className="text-[10.5px] uppercase tracking-wide text-slate-500">Seat platform fee</p><p className="text-xl font-semibold text-white">${seatCost.toLocaleString("en-US")}/mo</p></div>
      </div>
    </div>
  );
}
