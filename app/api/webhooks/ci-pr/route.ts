import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOrgForMcp } from "@/lib/api-token-auth";
import { biviaScoreAndSet } from "@/lib/bivia";
import { prisma } from "@/lib/db";
import { buildStepsJson, runTestCases } from "@/lib/engine";
import { jsonError, readJson, validationError } from "@/lib/http";
import { parseIntegrationConfig } from "@/lib/integration-providers";
import { buildPrGateMarkdown, type PrGateBivia, type PrGateImpact } from "@/lib/pr-gate";
import { runStrixScan } from "@/lib/strix";
import { audit, readSettings } from "@/lib/tenant";
import { normalizeWebsite } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/webhooks/ci-pr
 *
 * Autonomous CI/CD gatekeeper for GitHub Actions, GitLab CI, Azure DevOps and
 * any external pipeline. Authentication accepts `x-qasyn-token: cqa_…`,
 * `Authorization: Bearer cqa_…` or an authenticated dashboard session.
 *
 * Flow: upsert PullRequestCheck → map changed files to impacted modules/tests
 * → auto-create PR-specific Smoke (4 steps) and Regression (6 steps) cases
 * against the preview URL → execute the suite with per-step screenshots →
 * build the Bivia + Strix gate Markdown.
 */

const webhookSchema = z.object({
  prNumber: z.number().int().min(1).max(9_999_999),
  title: z.string().trim().min(3).max(300),
  branch: z.string().trim().min(1).max(160),
  branchTarget: z.string().trim().max(160).optional(),
  author: z.string().trim().max(160).optional(),
  repository: z.string().trim().max(200).optional(),
  changedFiles: z.array(z.string().trim().max(300)).max(200).optional(),
  previewUrl: z.string().trim().max(300).optional(),
  environmentName: z.string().trim().max(80).optional(),
  createTests: z.boolean().optional(),
  failOnRegression: z.boolean().optional(),
});

const LOW_SIGNAL_TOKENS = new Set([
  "src",
  "app",
  "lib",
  "ui",
  "components",
  "pages",
  "api",
  "tests",
  "test",
  "index",
  "main",
  "utils",
  "shared",
  "routes",
  "route",
  "page",
  "tsx",
  "ts",
  "js",
  "jsx",
]);

/** Extracts human-meaningful module tokens from changed file paths. */
function moduleTokens(files: string[]): string[] {
  const tokens = new Set<string>();
  for (const file of files) {
    for (const segment of file.toLowerCase().replace(/\\/g, "/").split("/")) {
      const cleaned = segment
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (!cleaned || LOW_SIGNAL_TOKENS.has(cleaned)) continue;
      tokens.add(cleaned);
    }
  }
  return [...tokens];
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value || "") as T;
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  const auth = await resolveOrgForMcp(request);
  if (!auth) {
    return jsonError("Unauthorized. Send x-qasyn-token: cqa_… (or Authorization: Bearer cqa_…) or sign in.", 401);
  }

  const parsed = webhookSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  const organisation = await prisma.organisation.findUnique({ where: { id: auth.organisationId } });
  if (!organisation) return jsonError("Organisation not found.", 404);
  const user =
    (await prisma.user.findFirst({ where: { organisationId: organisation.id, role: "Admin" }, orderBy: { createdAt: "asc" } })) ??
    (await prisma.user.findFirst({ where: { organisationId: organisation.id }, orderBy: { createdAt: "asc" } }));
  if (!user) return jsonError("No organisation member is available to attribute the webhook run.", 400);
  const actor = { org: organisation, user };

  const changedFiles = (input.changedFiles ?? []).filter(Boolean);
  const environment = input.environmentName
    ? await prisma.environmentConfig.findFirst({ where: { organisationId: organisation.id, name: input.environmentName } })
    : await prisma.environmentConfig.findFirst({ where: { organisationId: organisation.id, isDefault: true } });
  const targetUrl =
    normalizeWebsite(input.previewUrl ?? "") ??
    normalizeWebsite(environment?.baseUrl ?? "") ??
    normalizeWebsite(organisation.website ?? "") ??
    "https://www.cgi.com";

  const tokens = moduleTokens(changedFiles);
  const candidatePool = await prisma.testCase.findMany({
    where: { organisationId: organisation.id },
    orderBy: [{ criticality: "asc" }, { createdAt: "desc" }],
    take: 60,
  });
  const matched = candidatePool.filter((testCase) => {
    const haystack = `${testCase.module} ${testCase.title}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });
  const impacted = (matched.length > 0 ? matched : candidatePool).slice(0, 6);
  const modules = [...new Set((matched.length > 0 ? matched : candidatePool).map((testCase) => testCase.module))].filter(Boolean);
  const impactedIds = impacted.map((testCase) => testCase.id);

  const pr = await prisma.pullRequestCheck.upsert({
    where: { organisationId_prNumber: { organisationId: organisation.id, prNumber: input.prNumber } },
    create: {
      organisationId: organisation.id,
      prNumber: input.prNumber,
      title: input.title,
      branch: input.branch,
      branchTarget: input.branchTarget ?? "main",
      author: input.author ?? "ci-bot",
      provider: "CI/CD",
      repository: input.repository ?? null,
      externalUrl: null,
      status: "running",
      riskLevel: "medium",
      filesChanged: changedFiles.length,
      changedFilesJson: JSON.stringify(changedFiles),
      impactJson: JSON.stringify({ files: changedFiles, modules }),
      logsJson: "[]",
      testsRun: 0,
      regressions: 0,
    },
    update: {
      title: input.title,
      branch: input.branch,
      branchTarget: input.branchTarget ?? "main",
      author: input.author ?? "ci-bot",
      repository: input.repository ?? null,
      status: "running",
      filesChanged: changedFiles.length,
      changedFilesJson: JSON.stringify(changedFiles),
      impactJson: JSON.stringify({ files: changedFiles, modules }),
    },
  });

  // PR-specific cases make preview-URL coverage reproducible across CI runs.
  const titlePrefix = `PR #${input.prNumber} ·`;
  const existingPrCases = await prisma.testCase.findMany({
    where: { organisationId: organisation.id, title: { startsWith: titlePrefix } },
    orderBy: { createdAt: "asc" },
  });
  const createdTestCases: Array<{ id: string; title: string; testType: string; steps: number }> = [];
  if (input.createTests !== false && existingPrCases.length === 0) {
    const module = impacted[0]?.module || modules[0] || "Regression";
    const definitions = [
      { title: `${titlePrefix} Smoke check on ${environment?.name ?? "preview environment"}`, testType: "Smoke", stepsCount: 4, criticality: "high" },
      { title: `${titlePrefix} Regression flow`, testType: "Regression", stepsCount: 6, criticality: "high" },
    ];
    for (const definition of definitions) {
      const created = await prisma.testCase.create({
        data: {
          organisationId: organisation.id,
          title: definition.title,
          module,
          criticality: definition.criticality,
          status: "passing",
          stepsCount: definition.stepsCount,
          source: "manual",
          stepsJson: buildStepsJson(targetUrl, definition.stepsCount, module, definition.title, definition.testType),
          variablesJson: JSON.stringify({
            url: targetUrl,
            _testType: definition.testType,
            _prId: pr.id,
            _prNumber: input.prNumber,
            _environmentId: environment?.id ?? null,
            _source: "ci-webhook",
          }),
        },
      });
      createdTestCases.push({ id: created.id, title: created.title, testType: definition.testType, steps: definition.stepsCount });
    }
  }

  const prCases = createdTestCases.length
    ? await prisma.testCase.findMany({ where: { id: { in: createdTestCases.map((testCase) => testCase.id) } } })
    : existingPrCases;
  const uniqueCases = [...new Map([...impacted, ...prCases].map((testCase) => [testCase.id, testCase])).values()];
  if (uniqueCases.length === 0) return jsonError("No impacted or PR-specific test cases are available to run.", 400);

  const run = await runTestCases(prisma, actor, uniqueCases, {
    targetUrl,
    trigger: `Webhook PR #${input.prNumber}`,
    mode: "CI/CD Webhook Gate",
    deterministic: true,
  });

  // Calibrated Bivia /score + /set risk, mirroring the gate endpoint.
  const analysisCode = readSettings(organisation).analysisCode ?? null;
  let integrationConfig = null;
  try {
    const row = await prisma.integration.findUnique({
      where: { organisationId_provider: { organisationId: organisation.id, provider: "BIVIA" } },
      select: { configJson: true },
    });
    integrationConfig = row ? parseIntegrationConfig(row.configJson) : null;
  } catch {
    integrationConfig = null;
  }
  const decision = await biviaScoreAndSet({
    prTitle: input.title,
    changedFiles,
    candidateTests: impacted.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      module: testCase.module,
      criticality: testCase.criticality,
      status: testCase.status,
    })),
    organisationId: organisation.id,
    sources: { integrationConfig, analysisCode },
  });
  const bivia: PrGateBivia = {
    riskScore: Math.round(decision.riskScore * 10) / 10,
    riskLevel: decision.riskLevel,
    probabilityPct: Math.round(decision.probability * 1000) / 10,
    provider: decision.provider,
  };

  const strix = await runStrixScan(targetUrl);
  const regressions = run.failed;
  const status = regressions > 0 ? "regression_caught" : "passed_baseline";
  const verdict = regressions > 0 ? "BLOCKED" : "APPROVED";
  const executed = run.results.map((result) => ({ id: result.id, title: result.title, status: result.status, module: impactedIds.includes(result.id) ? impacted.find((testCase) => testCase.id === result.id)?.module : undefined }));
  const impact: PrGateImpact = {
    files: changedFiles,
    modules,
    blastRadius: changedFiles.length >= 8 ? "wide" : changedFiles.length >= 3 ? "moderate" : "narrow",
    impacted: impacted.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      module: testCase.module,
      criticality: testCase.criticality,
      status: testCase.status,
    })),
    executed,
    passed: run.passed,
    failed: run.failed,
    total: run.total,
    bivia,
  };

  const markdownReport = buildPrGateMarkdown({
    organisation: organisation.name,
    prNumber: input.prNumber,
    title: input.title,
    branch: input.branch,
    branchTarget: input.branchTarget ?? "main",
    author: input.author ?? "ci-bot",
    provider: "CI/CD",
    repository: input.repository ?? null,
    filesChanged: changedFiles.length,
    riskLevel: decision.riskLevel,
    files: changedFiles,
    impact,
    bivia,
    strix,
    targetUrl,
  });

  const now = new Date();
  const logs = [
    { at: now.toISOString(), level: "info", message: `CI webhook received for #${input.prNumber} (${auth.via}).` },
    { at: now.toISOString(), level: regressions > 0 ? "error" : "success", message: `${run.total} test(s) executed · ${run.passed} passed · ${run.failed} failed · ${regressions} regression(s).` },
  ];
  const updated = await prisma.pullRequestCheck.update({
    where: { id: pr.id },
    data: {
      status,
      riskLevel: decision.riskLevel,
      testsRun: run.total,
      regressions,
      impactJson: JSON.stringify({
        ...impact,
        autoRegression: {
          environmentId: environment?.id ?? null,
          environmentName: environment?.name ?? "Default environment",
          targetUrl,
          createdTestCases,
          testCaseIds: uniqueCases.map((testCase) => testCase.id),
          executed: run.results,
          passed: run.passed,
          failed: run.failed,
          total: run.total,
          regressions,
          ranAt: now.toISOString(),
        },
      }),
      logsJson: JSON.stringify(logs),
      commentBody: markdownReport,
    },
  });

  await audit(prisma, actor, "pr.webhook_gate", `#${input.prNumber} · ${verdict} · ${run.passed}/${run.total} · ${regressions} regression(s)`);

  return NextResponse.json(
    {
      ok: true,
      verdict,
      prId: updated.id,
      prNumber: input.prNumber,
      targetUrl,
      environment: environment ? { id: environment.id, name: environment.name, baseUrl: environment.baseUrl } : null,
      passed: run.passed,
      failed: run.failed,
      total: run.total,
      regressions,
      createdTestCases,
      executed: run.results,
      markdownReport,
      failOnRegression: input.failOnRegression ?? false,
      ranAt: now.toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
