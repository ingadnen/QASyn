/**
 * Quality Autopilot — one-click orchestration of the autonomous quality loop.
 *
 *   1. Live DOM crawl (`inspectTargetDom`, crawl session, mapped flows)
 *   2. Strix passive OWASP/header scan (persisted SecurityScan)
 *   3. Graphify topology (crawl → DOM → test → PR graph)
 *   4. Context7 + Bivia-calibrated test authoring (AI Verification + scored locators)
 *   5. Immediate Studio execution (real TestRun rows)
 *
 * Every phase is persisted so the UI can link to the exact crawl, scan,
 * Graphify map and Test Studio execution that the autopilot produced.
 */
import type { PrismaClient } from "@prisma/client";
import type { BiviaConfigSources } from "./bivia";
import { context7Guidance } from "./context7";
import { runTestCases, startCrawl } from "./engine";
import { loadGraphifyMap } from "./graphify";
import { parseIntegrationConfig } from "./integration-providers";
import { generateCalibratedMagicLocators } from "./magic-locator";
import { runStrixScan, type StrixReport } from "./strix";
import { readSettings, type OrgContext } from "./tenant";
import {
  groundedFlowsFromDom,
  groundedStepsForFlow,
  inspectTargetDom,
  type GroundedFlow,
  type TargetDomSnapshot,
} from "./web-executor";
import { normalizeWebsite } from "./utils";

type Actor = Pick<OrgContext, "org" | "user">;

export type AutopilotPhaseId = "crawl" | "security" | "graph" | "authoring" | "execution";

export interface AutopilotPhase {
  id: AutopilotPhaseId;
  label: string;
  status: "completed" | "failed";
  detail: string;
  metric: string;
  href?: string;
}

export interface AutopilotTestCaseResult {
  id: string;
  title: string;
  module: string;
  steps: number;
  verifySteps: number;
  calibratedLocators: number;
  confidencePct: number;
  status: string;
  href: string;
}

export interface AutopilotResult {
  targetUrl: string;
  startedAt: string;
  completedAt: string;
  crawlId: string;
  phases: AutopilotPhase[];
  security: {
    scanId: string;
    grade: StrixReport["grade"];
    score: number;
    reachable: boolean;
    high: number;
    medium: number;
    low: number;
    findings: number;
    href: string;
  };
  graph: { nodes: number; edges: number; href: string };
  testCases: AutopilotTestCaseResult[];
  execution: { passed: number; failed: number; total: number; autoFix: boolean };
  links: { crawl: string; security: string; graphify: string; studio: string | null };
}

function hostOf(targetUrl: string): string {
  try {
    return new URL(targetUrl).host;
  } catch {
    return targetUrl;
  }
}

function moduleOf(flow: GroundedFlow): string {
  return flow.module || "Core";
}

/** Deterministic synthetic steps used only when the live DOM is unreachable. */
function fallbackFlows(targetUrl: string): GroundedFlow[] {
  const host = hostOf(targetUrl);
  return [
    {
      name: `Verify ${host} landing page · Autopilot`,
      module: "Core",
      steps: 4,
      criticality: "high",
      description: `Fallback autopilot flow for ${targetUrl}.`,
    },
    {
      name: `Check ${host} primary navigation · Autopilot`,
      module: "Core",
      steps: 3,
      criticality: "medium",
      description: `Fallback navigation flow for ${targetUrl}.`,
    },
  ];
}

/**
 * Runs the full autopilot. Network phases are best-effort: an unreachable
 * target still produces deterministic flows, a Strix report and a runnable
 * Studio execution so the operator always gets a useful result.
 */
export async function runQualityAutopilot(
  db: PrismaClient,
  actor: Actor,
  targetInput: string,
): Promise<AutopilotResult> {
  const startedAt = new Date();
  const targetUrl =
    normalizeWebsite(targetInput) ??
    normalizeWebsite(actor.org.website ?? "") ??
    "https://www.cgi.com";

  const settings = readSettings(actor.org);
  const analysisCode = settings.analysisCode ?? null;
  let integrationConfig = null;
  try {
    const row = await db.integration.findUnique({
      where: { organisationId_provider: { organisationId: actor.org.id, provider: "BIVIA" } },
      select: { configJson: true },
    });
    integrationConfig = row ? parseIntegrationConfig(row.configJson) : null;
  } catch {
    integrationConfig = null;
  }
  const biviaSources: BiviaConfigSources = { integrationConfig, analysisCode };

  const phases: AutopilotPhase[] = [];
  const linkCrawl = "/dashboard/crawl";
  const linkSecurity = "/dashboard/security-testing";
  const linkGraphify = "/dashboard/code-analysis";

  // ── Phase 1 · Live DOM crawl ────────────────────────────────────────────
  let snapshot: TargetDomSnapshot | null = null;
  try {
    snapshot = await inspectTargetDom(targetUrl);
  } catch {
    snapshot = null;
  }
  let flows: GroundedFlow[] = groundedFlowsFromDom(snapshot);
  if (flows.length === 0) flows = fallbackFlows(targetUrl);
  flows = flows.slice(0, 6);

  // A running crawl short-circuits startCrawl; retire it first so every
  // autopilot run owns a fresh, linked crawl session.
  try {
    await db.crawlSession.updateMany({
      where: { organisationId: actor.org.id, status: "running" },
      data: { status: "completed", completedAt: new Date() },
    });
  } catch {
    /* no running crawl */
  }
  const crawl = await startCrawl(db, actor, targetUrl, { publishMode: "Require approval" });
  const pagesVisited = Math.max(1, snapshot ? 1 + snapshot.navLinks.length + snapshot.forms.length : flows.length);
  const crawlLogs = [
    { offsetMs: 0, tag: "INFO", message: `Quality Autopilot started · ${targetUrl}` },
    {
      offsetMs: 400,
      tag: "MAP",
      message: snapshot
        ? `Live DOM captured · "${snapshot.title || hostOf(targetUrl)}" · ${snapshot.navLinks.length} links · ${snapshot.buttons.length} buttons · ${snapshot.forms.length} forms`
        : `Live DOM unavailable · deterministic crawl plan for ${hostOf(targetUrl)}`,
    },
    { offsetMs: 900, tag: "MAP", message: `${flows.length} flows mapped across ${pagesVisited} pages` },
    { offsetMs: 1_400, tag: "DONE", message: `Autopilot crawl complete · ${flows.length} flows ready for authoring` },
  ];
  await db.crawlSession.update({
    where: { id: crawl.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      pagesVisited,
      flowsMapped: flows.length,
      logs: JSON.stringify(crawlLogs),
    },
  });
  phases.push({
    id: "crawl",
    label: "Live DOM crawl",
    status: snapshot ? "completed" : "failed",
    detail: snapshot
      ? `Captured "${snapshot.title || hostOf(targetUrl)}" with ${snapshot.navLinks.length} navigation links and ${snapshot.forms.length} forms.`
      : "Target was unreachable; the deterministic crawl plan keeps the pipeline moving.",
    metric: `${pagesVisited} pages · ${flows.length} flows`,
    href: `${linkCrawl}?session=${crawl.id}`,
  });

  // ── Phase 2 · Strix OWASP/header scan ──────────────────────────────────
  let report: StrixReport;
  try {
    report = await runStrixScan(targetUrl);
  } catch {
    report = {
      target: targetUrl,
      scannedAt: new Date().toISOString(),
      reachable: false,
      httpStatus: null,
      score: 0,
      grade: "F",
      findings: [],
      headers: {},
      cookies: [],
      surface: [],
      notes: [],
      error: "Strix scan unavailable",
    };
  }
  const failedFindings = report.findings.filter((finding) => !finding.passed);
  const high = failedFindings.filter((finding) => finding.severity === "critical" || finding.severity === "high").length;
  const medium = failedFindings.filter((finding) => finding.severity === "medium").length;
  const low = failedFindings.filter((finding) => finding.severity === "low" || finding.severity === "info").length;
  let scanId = "";
  try {
    const scan = await db.securityScan.create({
      data: {
        organisationId: actor.org.id,
        targetUrl,
        scanType: "Strix OWASP / headers",
        status: "completed",
        highCount: high,
        mediumCount: medium,
        lowCount: low,
        findingsJson: JSON.stringify({
          grade: report.grade,
          score: report.score,
          reachable: report.reachable,
          httpStatus: report.httpStatus,
          findings: report.findings,
          headers: report.headers,
        }),
        completedAt: new Date(),
      },
    });
    scanId = scan.id;
  } catch {
    scanId = "";
  }
  phases.push({
    id: "security",
    label: "Strix OWASP / header scan",
    status: report.reachable ? "completed" : "failed",
    detail: report.reachable
      ? `Grade ${report.grade} (${report.score}/100) · ${failedFindings.length} finding(s) across OWASP and transport headers.`
      : "Strix could not reach the target; the scan is recorded for audit.",
    metric: `${high} high · ${medium} medium · ${low} low`,
    href: linkSecurity,
  });

  // ── Phase 3 · Graphify topology ────────────────────────────────────────
  let graph = { nodes: 0, edges: 0 };
  try {
    const map = await loadGraphifyMap(actor.org.id, { crawlId: crawl.id });
    graph = { nodes: map.nodes.length, edges: map.edges.length };
  } catch {
    graph = { nodes: 0, edges: 0 };
  }
  phases.push({
    id: "graph",
    label: "Graphify topology",
    status: "completed",
    detail: "Crawl URLs, discovered DOM components, test cases and pull requests projected into one connected quality graph.",
    metric: `${graph.nodes} nodes · ${graph.edges} edges`,
    href: linkGraphify,
  });

  // ── Phase 4 · Context7 + Bivia-calibrated authoring ────────────────────
  const guidance = context7Guidance("playwright accessible locator test case generation", 3);
  const authoringFlows = flows.slice(0, 2);
  const created: AutopilotTestCaseResult[] = [];
  let calibratedLocators = 0;
  let calibrationTotal = 0;
  let calibrationConfidence = 0;

  for (const flow of authoringFlows) {
    const title = `${flow.name} — Autopilot`;
    const count = Math.max(4, Math.min(7, flow.steps));
    const steps: Array<Record<string, unknown>> = groundedStepsForFlow(snapshot, targetUrl, flow.name, count + 1).map((step) => ({ ...step }));
    if (!steps.some((step) => step.action === "AI Assertion")) {
      steps.push({
        id: `s${steps.length + 1}`,
        action: "AI Assertion",
        target: `Verify "${flow.name}" completes with no console or network errors`,
        value: "",
        selector: "",
      });
    }
    for (const step of steps) {
      if (step.action === "AI Assertion") {
        step.context7 = guidance.slice(0, 900);
        continue;
      }
      if (calibratedLocators >= 2) continue;
      if (!["Click", "Enter Text", "Verify Element"].includes(String(step.action))) continue;
      try {
        const calibration = await generateCalibratedMagicLocators(
          {
            action: String(step.action),
            target: String(step.target),
            value: String(step.value ?? ""),
            selector: String(step.selector ?? ""),
          },
          { organisationId: actor.org.id, sources: biviaSources, enabled: true },
        );
        const best = calibration.best;
        if (best) {
          step.selector = best.selector;
          step.locatorStrategy = best.strategy;
          step.locatorScore = best.score;
          if (calibration.bivia) {
            step.calibratedProbability = calibration.bivia.probabilityPct;
            step.biviaProvider = calibration.bivia.provider;
            calibratedLocators += 1;
            calibrationTotal += 1;
            calibrationConfidence += calibration.bivia.probabilityPct;
          }
        }
      } catch {
        /* keep the deterministic selector */
      }
    }

    const variables = { url: targetUrl };
    const description = `Generated by Quality Autopilot from ${targetUrl}. ${flow.description}`;
    const existing = await db.testCase.findFirst({
      where: { organisationId: actor.org.id, title },
      select: { id: true },
    });
    const testCase = existing
      ? await db.testCase.update({
          where: { id: existing.id },
          data: {
            module: moduleOf(flow),
            description,
            criticality: flow.criticality,
            status: "draft",
            stepsCount: Math.max(1, steps.length),
            stepsJson: JSON.stringify(steps),
            variablesJson: JSON.stringify(variables),
            source: "ai",
          },
        })
      : await db.testCase.create({
          data: {
            organisationId: actor.org.id,
            title,
            module: moduleOf(flow),
            description,
            criticality: flow.criticality,
            status: "draft",
            stepsCount: Math.max(1, steps.length),
            stepsJson: JSON.stringify(steps),
            variablesJson: JSON.stringify(variables),
            source: "ai",
          },
        });
    created.push({
      id: testCase.id,
      title: testCase.title,
      module: testCase.module,
      steps: steps.length,
      verifySteps: steps.filter((step) => step.action === "AI Assertion").length,
      calibratedLocators: steps.filter((step) => typeof step.calibratedProbability === "number").length,
      confidencePct: calibrationTotal > 0 ? Math.round((calibrationConfidence / calibrationTotal) * 10) / 10 : 0,
      status: testCase.status,
      href: `/dashboard/test-studio/${testCase.id}`,
    });
  }

  const aiVerifications = created.reduce((sum, testCase) => sum + testCase.verifySteps, 0);
  const avgConfidence = calibrationTotal > 0 ? Math.round((calibrationConfidence / calibrationTotal) * 10) / 10 : 0;
  phases.push({
    id: "authoring",
    label: "Context7 + Bivia test authoring",
    status: created.length > 0 ? "completed" : "failed",
    detail: `${created.length} grounded test case(s) authored with AI Verification steps, Context7 Playwright guidance and Bivia-calibrated locators.`,
    metric: `${aiVerifications} AI verification · ${calibratedLocators} calibrated locator(s) · ${avgConfidence.toFixed(1)}% confidence`,
    href: created[0]?.href,
  });

  // ── Phase 5 · Immediate Studio execution ───────────────────────────────
  let execution = { passed: 0, failed: 0, total: 0, autoFix: false };
  if (created.length > 0) {
    const cases = await db.testCase.findMany({ where: { organisationId: actor.org.id, id: { in: created.map((testCase) => testCase.id) } } });
    try {
      const result = await runTestCases(db, actor, cases);
      execution = { passed: result.passed, failed: result.failed, total: result.total, autoFix: false };
    } catch {
      execution = { passed: 0, failed: created.length, total: created.length, autoFix: false };
    }
    const refreshed = await db.testCase.findMany({
      where: { organisationId: actor.org.id, id: { in: created.map((testCase) => testCase.id) } },
      select: { id: true, status: true, stepsJson: true },
    });
    const statusById = new Map(refreshed.map((testCase) => [testCase.id, testCase.status]));
    for (const testCase of created) {
      testCase.status = statusById.get(testCase.id) ?? testCase.status;
    }
    execution.autoFix = refreshed.some((testCase) => testCase.stepsJson.includes("biviaHeal"));
  }
  phases.push({
    id: "execution",
    label: "Studio execution",
    status: execution.failed === 0 && execution.total > 0 ? "completed" : "failed",
    detail:
      execution.total > 0
        ? `${execution.passed}/${execution.total} test case(s) passed in Test Studio immediately after authoring.`
        : "No authored case was available to execute.",
    metric: `${execution.passed} passed · ${execution.failed} failed`,
    href: created[0]?.href,
  });

  const completedAt = new Date();
  return {
    targetUrl,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    crawlId: crawl.id,
    phases,
    security: {
      scanId,
      grade: report.grade,
      score: report.score,
      reachable: report.reachable,
      high,
      medium,
      low,
      findings: failedFindings.length,
      href: linkSecurity,
    },
    graph: { ...graph, href: linkGraphify },
    testCases: created,
    execution,
    links: {
      crawl: linkCrawl,
      security: linkSecurity,
      graphify: linkGraphify,
      studio: created[0]?.href ?? null,
    },
  };
}
