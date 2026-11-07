/**
 * Risk-based testing: commit churn + flakiness → risk score and prioritized tests.
 */
export interface RiskInput {
  filesChanged: number;
  modulesTouched: string[];
  flakyCases: number;
  failingCases: number;
  coverageGap: number; // 0–100
}

export interface RiskResult {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: Array<{ label: string; weight: number }>;
}

export function computeRisk(input: RiskInput): RiskResult {
  const factors = [
    { label: "Code churn", weight: Math.min(30, input.filesChanged * 2) },
    { label: "Modules touched", weight: Math.min(20, input.modulesTouched.length * 5) },
    { label: "Flaky test cases", weight: Math.min(25, input.flakyCases * 8) },
    { label: "Failing test cases", weight: Math.min(15, input.failingCases * 5) },
    { label: "Coverage gap", weight: Math.round(input.coverageGap * 0.1) },
  ];
  const score = Math.min(100, factors.reduce((s, f) => s + f.weight, 0));
  const level = score >= 80 ? "CRITICAL" : score >= 55 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
  return { score, level, factors };
}

/** Orders test cases by failure probability (failing > flaky > critical > others). */
export function prioritize(cases: Array<{ id: string; title: string; status: string; criticality: string }>): Array<{ id: string; title: string; score: number }> {
  const weight = (c: { status: string; criticality: string }) =>
    (c.status === "failing" ? 50 : c.status === "flaky" ? 30 : 10) + (c.criticality === "critical" ? 25 : c.criticality === "high" ? 15 : 5);
  return cases.map((c) => ({ id: c.id, title: c.title, score: weight(c) })).sort((a, b) => b.score - a.score);
}
