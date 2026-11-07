/**
 * Performance metrics: simulated Web Vitals capture and budget validation.
 */
export interface Vital {
  metric: "LCP" | "FCP" | "CLS" | "TTFB" | "TTI";
  value: number;
  threshold: number;
  passed: boolean;
  unit: string;
}

const BUDGETS: Record<Vital["metric"], { threshold: number; unit: string }> = {
  LCP: { threshold: 2500, unit: "ms" },
  FCP: { threshold: 1800, unit: "ms" },
  CLS: { threshold: 0.1, unit: "score" },
  TTFB: { threshold: 800, unit: "ms" },
  TTI: { threshold: 3800, unit: "ms" },
};

/** Deterministic simulated vitals from a seed (e.g. run id). */
export function simulateVitals(seed: string): Vital[] {
  let h = 0;
  for (const c of seed) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  const rand = (n: number) => {
    h = (Math.imul(h, 1103515245) + 12345) | 0;
    return (h >>> 0) / n;
  };
  return (Object.keys(BUDGETS) as Vital["metric"][]).map((metric) => {
    const { threshold, unit } = BUDGETS[metric];
    const factor = metric === "CLS" ? 0.05 + (rand(100) / 100) * 0.2 : 0.6 + (rand(100) / 100) * 0.9;
    const value = Math.round(threshold * factor * 100) / 100;
    return { metric, value, threshold, passed: value <= threshold, unit };
  });
}
