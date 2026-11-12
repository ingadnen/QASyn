/**
 * QASyn autonomous engine (consolidated): PR analyzer, blast-radius mapping,
 * bug reproducer and the end-to-end release pipeline facade.
 * All functions are pure/deterministic and organisation-scoped by callers.
 */
import { analyzePrImpact, reproduceBug, type PrImpact } from "./engines";

export interface BlastRadius {
  modules: string[];
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affectedFlows: string[];
  fastFeedback: string[];
  fullRegression: string[];
}

const FLOW_BY_MODULE: Record<string, string[]> = {
  Core: ["Account Creation", "Account Recovery", "Language Localization", "Social Login"],
  Billing: ["Subscription upgrade", "Invoice download", "Payment method update"],
  Settings: ["Team invite", "Role change", "API token rotation"],
  Checkout: ["Guest checkout", "Wallet payment", "Declined card handling"],
};

/** PR analyzer: diff → blast radius → risk score → prioritized subsets. */
export function analyzeBlastRadius(files: string[], testCases: Array<{ id: string; title: string; module: string; status: string }>): BlastRadius & Omit<PrImpact, "riskLevel"> {
  const impact = analyzePrImpact(files, testCases);
  const riskScore = impact.riskLevel === "high" ? 85 : impact.riskLevel === "medium" ? 55 : 25;
  const affectedFlows = impact.assessment.modules.flatMap((m) => FLOW_BY_MODULE[m] ?? []);
  const fastFeedback = impact.scopeTitles.filter((t) => /login|checkout|session|payment/i.test(t)).slice(0, 5);
  const fullRegression = impact.scopeTitles.slice(0, 20);
  const { riskLevel: _ignored, ...rest } = impact;
  return {
    ...rest,
    modules: impact.assessment.modules,
    riskScore,
    riskLevel: riskScore >= 80 ? "CRITICAL" : riskScore >= 55 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW",
    affectedFlows,
    fastFeedback,
    fullRegression,
  };
}

export { reproduceBug };

/** Pipeline facade shared by /api/dashboard/qasyn/* routes. */
export const QASYN_STAGES = ["Crawl", "Requirements", "Test generation", "Execution", "Release report"] as const;

export function qasynVerdict(passRate: number): "Go" | "No-Go" {
  return passRate >= 70 ? "Go" : "No-Go";
}
