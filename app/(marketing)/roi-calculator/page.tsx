import type { Metadata } from "next";
import { RoiCalculator } from "@/components/marketing/RoiCalculator";

export const metadata: Metadata = { title: "ROI calculator" };
export const dynamic = "force-dynamic";

export default function RoiPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-xs font-semibold tracking-[0.16em] text-brand-600 uppercase">Resources · ROI calculator</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Testing ROI calculator</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">Estimate annual savings, release velocity gains and time-to-value of autonomous testing.</p>
      <div className="mt-8">
        <RoiCalculator />
      </div>
    </div>
  );
}
