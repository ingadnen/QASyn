/**
 * CI/CD PR Gate comment generator.
 *
 * Pure Markdown builder used by POST /api/dashboard/pull-requests/gate so the
 * exact report can be previewed, copied and posted to the provider. The gate
 * combines the calibrated Bivia risk verdict with the Strix security surface
 * and the executed impact set.
 */
import type { StrixReport, StrixSeverity } from "./strix";

export interface PrGateBivia {
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  probabilityPct: number;
  provider: string;
}

export interface PrGateExecutedTest {
  id: string;
  title: string;
  module?: string;
  status: string;
}

export interface PrGateImpact {
  files?: string[];
  modules?: string[];
  blastRadius?: string;
  impacted?: Array<{ id: string; title: string; module?: string; criticality?: string; status: string }>;
  executed?: PrGateExecutedTest[];
  passed?: number;
  failed?: number;
  total?: number;
  testsSelected?: number;
  bivia?: PrGateBivia | null;
}

export interface PrGateInput {
  organisation: string;
  prNumber: number;
  title: string;
  branch: string;
  branchTarget: string;
  author: string;
  provider?: string | null;
  repository?: string | null;
  filesChanged: number;
  riskLevel: string;
  files: string[];
  impact: PrGateImpact;
  bivia: PrGateBivia | null;
  strix: StrixReport;
  targetUrl: string;
  generatedAt?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function derivePrGateRisk(input: Pick<PrGateInput, "files" | "impact" | "bivia">): PrGateBivia {
  if (input.bivia) return input.bivia;
  const files = input.files.length || input.impact.files?.length || 0;
  const failed = input.impact.failed ?? input.impact.executed?.filter((test) => test.status !== "passing").length ?? 0;
  const wide = input.impact.blastRadius === "wide";
  const moderate = input.impact.blastRadius === "moderate";
  const riskScore = round1(clamp(files * 0.12 + failed * 1.8 + (wide ? 3 : moderate ? 1.4 : 0.3), 0, 10));
  return {
    riskScore,
    riskLevel: riskScore >= 7 ? "high" : riskScore >= 4 ? "medium" : "low",
    probabilityPct: round1(clamp(72 + riskScore * 2.1, 72, 96)),
    provider: "bivia-calibrated-fallback",
  };
}

export interface PrGateVerdict {
  blocked: boolean;
  label: "✅ APPROVED FOR MERGE" | "🛑 BLOCKED — HIGH BLAST RADIUS";
  reason: string;
}

export function prGateVerdict(input: Pick<PrGateInput, "impact" | "bivia">): PrGateVerdict {
  const bivia = input.bivia ?? derivePrGateRisk({ files: input.impact.files ?? [], impact: input.impact, bivia: null });
  const failed = input.impact.failed ?? input.impact.executed?.filter((test) => test.status !== "passing").length ?? 0;
  const blocked = bivia.riskLevel === "high" || bivia.riskScore >= 7 || failed > 0;
  return {
    blocked,
    label: blocked ? "🛑 BLOCKED — HIGH BLAST RADIUS" : "✅ APPROVED FOR MERGE",
    reason: blocked
      ? `${failed} impacted test(s) failed or the calibrated risk is ${bivia.riskScore.toFixed(1)}/10 (${bivia.riskLevel}).`
      : `All impacted tests passed baseline and the calibrated risk is ${bivia.riskScore.toFixed(1)}/10 (${bivia.riskLevel}).`,
  };
}

function severityRows(findings: StrixReport["findings"]): Array<[StrixSeverity, number]> {
  const severities: StrixSeverity[] = ["critical", "high", "medium", "low", "info"];
  return severities
    .map((severity) => [severity, findings.filter((finding) => !finding.passed && finding.severity === severity).length] as [StrixSeverity, number])
    .filter(([, count]) => count > 0);
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Builds the CI/CD gate comment. Deterministic for the same input. */
export function buildPrGateMarkdown(input: PrGateInput): string {
  const bivia = input.bivia ?? derivePrGateRisk({ files: input.files, impact: input.impact, bivia: null });
  const verdict = prGateVerdict({ impact: input.impact, bivia });
  const files = input.impact.files?.length ? input.impact.files : input.files;
  const modules = input.impact.modules?.length ? input.impact.modules : ["Core"];
  const impactById = new Map((input.impact.impacted ?? []).map((test) => [test.id, test]));
  const executed = (input.impact.executed ?? []).length
    ? input.impact.executed ?? []
    : (input.impact.impacted ?? []).map((test) => ({ id: test.id, title: test.title, module: test.module, status: test.status }));
  const passed = input.impact.passed ?? executed.filter((test) => test.status === "passing").length;
  const failed = input.impact.failed ?? executed.filter((test) => test.status !== "passing").length;
  const findings = input.strix.findings.filter((finding) => !finding.passed);
  const severity = severityRows(findings);
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const lines: string[] = [
    `## QASyn CI/CD PR Gate — ${verdict.label}`,
    "",
    `**Pull request:** #${input.prNumber} ${input.title}`,
    `**Repository:** ${input.repository ?? (input.provider ? `${input.provider} repository` : "workspace")}`,
    `**Branch:** \`${input.branch}\` → \`${input.branchTarget}\``,
    `**Author:** ${input.author}`,
    `**Target:** ${input.targetUrl}`,
    "",
    `**QASyn Vision AI verdict:** ${verdict.label}`,
    `**Calibrated risk score:** ${bivia.riskScore.toFixed(1)} / 10 · **confidence ${bivia.probabilityPct.toFixed(1)}%** · ${bivia.riskLevel} blast radius`,
    `**Decision reason:** ${verdict.reason}`,
    `**Provider:** QASyn Vision AI · **Changed files:** ${input.filesChanged || files.length} · **Modules:** ${modules.join(", ")}`,
    "",
    "### 🧠 QASyn Vision AI impacted tests",
    "",
    "| Test case | Module | Result |",
    "| --- | --- | --- |",
    ...(executed.length
      ? executed.slice(0, 20).map((test) => {
          const detail = impactById.get(test.id);
          const moduleName = test.module ?? detail?.module ?? "Core";
          const result = test.status === "passing" ? "✅ Passed" : "❌ Failed";
          return `| ${escapeCell(test.title)} | ${escapeCell(moduleName)} | ${result} |`;
        })
      : ["| _No impacted tests selected_ | — | — |"]),
    "",
    `**Impacted tests:** ${executed.length} · **Passed:** ${passed} · **Failed:** ${failed} · **Blast radius:** ${input.impact.blastRadius ?? input.riskLevel}`,
    "",
    "### 🛡️ Strix security summary",
    "",
    input.strix.reachable
      ? `**Grade:** ${input.strix.grade} · **Score:** ${input.strix.score}/100 · **HTTP:** ${input.strix.httpStatus ?? "n/a"} · **Findings:** ${findings.length} failed / ${input.strix.findings.length} checks`
      : "**Strix could not reach the target.** The passive scan is recorded for audit; treat the security posture as unknown.",
    "",
    "| Severity | Failed findings |",
    "| --- | --- |",
    ...(severity.length ? severity.map(([level, count]) => `| ${level} | ${count} |`) : ["| none | 0 |"]),
    "",
    ...(findings.length
      ? [
          "**Top findings:**",
          ...findings.slice(0, 6).map((finding) => `- **[${finding.severity}]** ${finding.title} · ${finding.owasp} — ${finding.evidence.slice(0, 160)}`),
          "",
        ]
      : ["**No failed Strix checks.**", ""]),
    "### Blast radius",
    "",
    ...files.slice(0, 15).map((file) => `- \`${file}\``),
    ...(files.length > 15 ? [`- …and ${files.length - 15} more file(s)`] : []),
    "",
    "---",
    `_Generated by QASyn PR Gatekeeper · QASyn Vision AI calibrated · ${generatedAt}_`,
  ];
  return lines.join("\n");
}
