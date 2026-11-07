"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";

export function RoiCalculator() {
  const [engineers, setEngineers] = useState(5);
  const [rate, setRate] = useState(80);
  const [releases, setReleases] = useState(4);
  const [coverage, setCoverage] = useState(30);
  const [manualHours, setManualHours] = useState(60);
  const [maintenanceHours, setMaintenanceHours] = useState(20);
  const [result, setResult] = useState<{ saved: number; hours: number; roi: number; paybackWeeks: number } | null>(null);
  const [email, setEmail] = useState("");
  const [captured, setCaptured] = useState(false);
  const [busy, setBusy] = useState(false);

  function compute() {
    const monthlyHours = manualHours + maintenanceHours;
    const automationLift = (100 - coverage) / 100; // share automatable
    const hoursSaved = Math.round(monthlyHours * automationLift * 0.85 * 12);
    const saved = hoursSaved * rate * engineers;
    const roi = engineers ? Math.round((saved / (engineers * rate * 40 * 4)) * 100) : 0;
    const paybackWeeks = saved > 0 ? Math.ceil(((releases * 4000) / saved) * 52) : 0;
    setResult({ saved, hours: hoursSaved, roi, paybackWeeks });
  }

  async function exportReport() {
    setBusy(true);
    try {
      await apiFetch("/api/marketing/lead", { method: "POST", json: { email, source: "roi-calculator", metadata: result } });
      setCaptured(true);
    } catch {
      setCaptured(false);
    } finally {
      setBusy(false);
    }
  }

  const field = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm";
  const row = (label: string, value: number, set: (n: number) => void, suffix: string) => (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input className={`${field} mt-1`} type="number" value={value} onChange={(e) => set(Number(e.target.value))} />
      <span className="text-xs text-slate-400">{suffix}</span>
    </label>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-line bg-white p-6">
        {row("QA engineers", engineers, setEngineers, "team size")}
        {row("Average hourly rate", rate, setRate, "$ / hour")}
        {row("Releases per month", releases, setReleases, "release cadence")}
        {row("Current automation coverage", coverage, setCoverage, "%")}
        {row("Manual testing hours / month", manualHours, setManualHours, "hours")}
        {row("Test maintenance hours / month", maintenanceHours, setMaintenanceHours, "hours")}
        <Button onClick={compute}>Calculate ROI</Button>
      </div>
      <div>
        {result ? (
          <div className="space-y-3 rounded-xl border border-line bg-white p-6">
            <p className="text-3xl font-semibold text-ink">${result.saved.toLocaleString()} <span className="text-sm font-normal text-muted">saved per year</span></p>
            <p className="text-sm text-muted">{result.hours.toLocaleString()} engineering hours saved annually</p>
            <p className="text-sm text-muted">ROI: <strong className="text-ink">{result.roi}%</strong> · payback in {result.paybackWeeks} weeks</p>
            <label className="block pt-2">
              <span className="text-xs font-medium text-slate-600">Email to export the PDF report</span>
              <input className={`${field} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
            <Button onClick={() => void exportReport()} loading={busy} disabled={!email.includes("@")}>Export PDF report</Button>
            {captured && <p className="text-sm text-emerald-600">Report requested — check your inbox.</p>}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-muted">Adjust the inputs and click Calculate ROI.</p>
        )}
      </div>
    </div>
  );
}
