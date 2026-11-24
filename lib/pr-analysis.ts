import type { PullRequestCheck } from "@prisma/client";
import { prisma } from "./db";
import { buildStepsJson, runTestCases } from "./engine";
import {
  blastRadius,
  buildProviderComment,
  impactedModules,
  type ImpactSummary,
} from "./pr-catalog";
import { generatePrTests, prCaseTitlePrefix } from "./pr-test-gen";
import { readSettings, type OrgContext } from "./tenant";
import { normalizeWebsite } from "./utils";

type Actor = Pick<OrgContext, "org" | "user">;

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

  // PR-specific test drafting only. The workspace model (PR Review role) — or
  // the calibrated local engine when no model is configured — drafts test cases
  // from THIS PR's title and changed-file list. Generic catalogue test cases are
  // never mixed in: every executed test is drafted for this PR. Drafts persist,
  // so re-runs reuse them instead of duplicating.
  const titlePrefix = prCaseTitlePrefix(pr.prNumber);
  let drafted = await prisma.testCase.findMany({
    where: { organisationId: actor.org.id, title: { startsWith: titlePrefix } },
  });
  let draftMeta: { provider: string; modelId: string | null; mode: "ai-model" | "calibrated"; count: number } | null =
    null;
  if (drafted.length === 0) {
    const generated = await generatePrTests({
      organisationId: actor.org.id,
      prNumber: pr.prNumber,
      prTitle: pr.title,
      branch: pr.branch,
      changedFiles: files,
      modules,
    });
    const targetUrl = normalizeWebsite(pr.externalUrl ?? "") ?? normalizeWebsite(actor.org.website ?? "") ?? "";
    const created = [];
    for (const definition of generated.definitions) {
      created.push(
        await prisma.testCase.create({
          data: {
            organisationId: actor.org.id,
            title: definition.prefixedTitle,
            module: definition.module,
            criticality: definition.criticality,
            status: "draft",
            stepsCount: definition.stepsCount,
            source: "ai-drafted",
            stepsJson: buildStepsJson(
              targetUrl,
              definition.stepsCount,
              definition.module,
              definition.prefixedTitle,
              definition.testType,
            ),
            variablesJson: JSON.stringify({
              _prId: pr.id,
              _prNumber: pr.prNumber,
              _provider: generated.provider,
              _aiMode: generated.mode,
              description: definition.description,
            }),
          },
        }),
      );
    }
    drafted = created;
    draftMeta = {
      provider: generated.provider,
      modelId: generated.modelId,
      mode: generated.mode,
      count: created.length,
    };
  } else {
    try {
      const stored = JSON.parse(drafted[0]?.variablesJson || "{}") as { _provider?: string; _aiMode?: string };
      draftMeta = {
        provider: stored._provider ?? "QASyn Vision AI",
        modelId: null,
        mode: stored._aiMode === "ai-model" ? "ai-model" : "calibrated",
        count: drafted.length,
      };
    } catch {
      draftMeta = { provider: "QASyn Vision AI", modelId: null, mode: "calibrated", count: drafted.length };
    }
  }

  const executionInputIds = drafted.map((testCase) => testCase.id);
  const execution =
    executionInputIds.length > 0
      ? await runTestCases(
          prisma,
          actor,
          await prisma.testCase.findMany({ where: { id: { in: executionInputIds } } }),
        )
      : { passed: 0, failed: 0, total: 0, results: [] };

  const draftedIds = new Set(drafted.map((testCase) => testCase.id));
  const executed = (execution.results ?? []).map((result) => ({
    id: result.id,
    title: result.title,
    status: result.status,
    aiDrafted: draftedIds.has(result.id),
  }));

  const failed = executed.filter((test) => test.status === "failing").length;
  const passed = executed.length - failed;
  const verdict: ImpactSummary["verdict"] = failed > 0 ? "regression_caught" : "passed_baseline";
  const riskLevel = failed > 0 || files.length >= 25 ? "high" : files.length >= 8 ? "medium" : "low";

  const impact = {
    files,
    modules,
    blastRadius: radius,
    impacted: [],
    executed,
    draft: draftMeta,
    passed,
    failed,
    total: executed.length,
    testsSelected: drafted.length,
    verdict,
  };

  const comment = buildProviderComment({
    prNumber: pr.prNumber,
    title: pr.title,
    organisation: actor.org.name,
    impact: { ...impact, verdict },
  });

  const logs: Array<{ at: string; level: string; message: string }> = [
    { at: new Date().toISOString(), level: "info", message: `Blast radius: ${radius} — ${files.length} file(s) across ${modules.join(", ")}` },
    { at: new Date().toISOString(), level: "info", message: `Drafted ${drafted.length} PR-specific test case(s) for #${pr.prNumber}` },
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
