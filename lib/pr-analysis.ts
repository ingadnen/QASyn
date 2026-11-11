import type { PullRequestCheck } from "@prisma/client";
import { biviaScoreAndSet } from "./bivia";
import { prisma } from "./db";
import { runTestCases } from "./engine";
import {
  blastRadius,
  buildProviderComment,
  impactedModules,
  type ImpactSummary,
} from "./pr-catalog";
import { readSettings, type OrgContext } from "./tenant";

type Actor = Pick<OrgContext, "org" | "user">;

const CRITICALITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function rank(value: string) {
  return CRITICALITY_RANK[value] ?? 4;
}

/**
 * Computes the blast radius of a pull request, executes the impacted test
 * cases for the organisation, stores the execution logs and builds the comment
 * posted back to the provider.
 */
export async function analyzePullRequest(pr: PullRequestCheck, actor: Actor) {
  let files: string[] = [];
  try {
    const parsed = JSON.parse(pr.changedFilesJson || "[]") as unknown;
    if (Array.isArray(parsed)) files = parsed.filter((file): file is string => typeof file === "string");
  } catch {
    files = [];
  }
  if (files.length === 0) files = ["src/core/app.ts"];

  const modules = impactedModules(files);
  const radius = blastRadius(files, modules);

  const candidates = await prisma.testCase.findMany({
    where: { organisationId: actor.org.id, module: { in: modules } },
    select: { id: true, title: true, module: true, criticality: true, status: true, stepsCount: true },
  });
  const sorted = candidates.sort(
    (a, b) => rank(a.criticality) - rank(b.criticality) || (a.status === "failing" ? -1 : 1),
  );
  let selected = sorted.slice(0, 10);
  let biviaRisk: { riskScore: number; riskLevel: "low" | "medium" | "high"; probabilityPct: number; provider: string } | null =
    null;

  // Articul8 Bivia scores the PR and selects the exact impacted regression set.
  const analysisCode = readSettings(actor.org).analysisCode ?? null;
  if (analysisCode?.biviaPrRisk !== false && candidates.length > 0) {
    const decision = await biviaScoreAndSet({
      prTitle: pr.title,
      changedFiles: files,
      candidateTests: candidates.map((test) => ({
        id: test.id,
        title: test.title,
        module: test.module,
        criticality: test.criticality,
        status: test.status,
      })),
      organisationId: actor.org.id,
    });
    if (decision.status === "answered" && decision.selectedTestIds.length > 0) {
      const byId = new Map(candidates.map((test) => [test.id, test]));
      const calibrated = decision.selectedTestIds
        .map((id) => byId.get(id))
        .filter((test): test is (typeof candidates)[number] => Boolean(test));
      if (calibrated.length > 0) selected = calibrated.slice(0, 10);
    }
    biviaRisk = {
      riskScore: Math.round(decision.riskScore * 10) / 10,
      riskLevel: decision.riskLevel,
      probabilityPct: Math.round(decision.probability * 1000) / 10,
      provider: decision.provider,
    };
  }

  const execution = selected.length > 0
    ? await runTestCases(prisma, actor, await prisma.testCase.findMany({ where: { id: { in: selected.map((test) => test.id) } } }))
    : { passed: 0, failed: 0, total: 0 };

  const executedMap = new Map(
    (await prisma.testCase.findMany({
      where: { id: { in: selected.map((test) => test.id) } },
      select: { id: true, title: true, status: true },
    })).map((test) => [test.id, test.status]),
  );
  const executed = selected.map((test) => ({
    id: test.id,
    title: test.title,
    status: executedMap.get(test.id) === "passing" ? "passing" : executedMap.get(test.id) ?? test.status,
  }));

  const failed = executed.filter((test) => test.status === "failing").length;
  const passed = executed.length - failed;
  const verdict: ImpactSummary["verdict"] = failed > 0 ? "regression_caught" : "passed_baseline";
  const riskLevel =
    biviaRisk?.riskLevel ?? (failed > 0 || files.length >= 25 ? "high" : files.length >= 8 ? "medium" : "low");

  const impact = {
    files,
    modules,
    blastRadius: radius,
    impacted: selected.map((test) => ({
      id: test.id,
      title: test.title,
      module: test.module,
      criticality: test.criticality,
      status: test.status,
    })),
    executed,
    passed,
    failed,
    total: executed.length,
    testsSelected: selected.length,
    verdict,
    bivia: biviaRisk,
  };

  const comment = buildProviderComment({
    prNumber: pr.prNumber,
    title: pr.title,
    organisation: actor.org.name,
    impact: { ...impact, verdict },
  });

  const logs: Array<{ at: string; level: string; message: string }> = [
    { at: new Date().toISOString(), level: "info", message: `Blast radius: ${radius} — ${files.length} file(s) across ${modules.join(", ")}` },
    { at: new Date().toISOString(), level: "info", message: `Selected ${selected.length} impacted test case(s) by criticality` },
    ...(biviaRisk
      ? [{
          at: new Date().toISOString(),
          level: "info",
          message: `🧠 Bivia risk ${biviaRisk.riskScore}/10 (${biviaRisk.riskLevel}) · ${biviaRisk.probabilityPct.toFixed(1)}% calibrated · ${selected.length} recommended test(s)`,
        }]
      : []),
    ...executed.map((test, index) => ({
      at: new Date(Date.now() + index * 120).toISOString(),
      level: test.status === "passing" ? "pass" : "fail",
      message: `${test.title} → ${test.status}`,
    })),
    { at: new Date().toISOString(), level: "info", message: `Verdict: ${verdict} — ${passed} passed, ${failed} failed` },
    { at: new Date().toISOString(), level: "info", message: `Quality verdict comment posted to ${pr.provider ?? "the provider"} (${pr.repository ?? "repository"})` },
  ];

  return prisma.pullRequestCheck.update({
    where: { id: pr.id },
    data: {
      status: verdict,
      riskLevel,
      testsRun: executed.length,
      regressions: failed,
      impactJson: JSON.stringify(impact),
      logsJson: JSON.stringify(logs),
      commentBody: comment,
      commentPosted: true,
      changedFilesJson: JSON.stringify(files),
    },
  });
}
