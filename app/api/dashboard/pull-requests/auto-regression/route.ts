import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildStepsJson, runTestCases } from "@/lib/engine";
import { jsonError, readJson, validationError } from "@/lib/http";
import { guardPermission } from "@/lib/rbac-server";
import { audit } from "@/lib/tenant";
import { normalizeWebsite } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const autoRegressionSchema = z.object({
  id: z.string().min(1).max(60),
  environmentId: z.string().max(60).optional(),
  targetUrl: z.string().trim().max(300).optional(),
  createTests: z.boolean().optional(),
});

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value || "") as T;
  } catch {
    return fallback;
  }
}

interface ImpactShape {
  modules?: string[];
  impacted?: Array<{ id: string; title: string; module: string; criticality?: string; status?: string }>;
  [key: string]: unknown;
}

/**
 * POST /api/dashboard/pull-requests/auto-regression
 * { id, environmentId?, targetUrl?, createTests? }
 *
 * Runs the PR's impacted regression tests plus freshly generated PR-specific
 * smoke/regression cases against the selected deployed environment. Every
 * executed step persists screenshot evidence through `runTestCases`, and the
 * PullRequestCheck row is updated with the verdict, counts and run metadata.
 */
export async function POST(request: Request) {
  const guard = await guardPermission("prRun");
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = autoRegressionSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  const pr = await prisma.pullRequestCheck.findFirst({ where: { id: input.id, organisationId: ctx.org.id } });
  if (!pr) return jsonError("Pull request not found.", 404);

  const environment = input.environmentId
    ? await prisma.environmentConfig.findFirst({
        where: { id: input.environmentId, organisationId: ctx.org.id },
      })
    : (await prisma.environmentConfig.findFirst({
        where: { organisationId: ctx.org.id, isDefault: true },
      })) ??
      (await prisma.environmentConfig.findFirst({
        where: { organisationId: ctx.org.id },
        orderBy: { createdAt: "asc" },
      }));

  const targetUrl =
    normalizeWebsite(input.targetUrl ?? "") ??
    normalizeWebsite(environment?.baseUrl ?? "") ??
    normalizeWebsite(ctx.org.website ?? "") ??
    normalizeWebsite(pr.externalUrl ?? "") ??
    "https://www.cgi.com";

  const impact = parseJson<ImpactShape>(pr.impactJson, {});
  const impacted = Array.isArray(impact.impacted) ? impact.impacted : [];
  const impactedIds = impacted.map((test) => test.id).filter(Boolean);
  const modules = [...new Set((impact.modules ?? []).filter(Boolean))];

  const existingByModule = await prisma.testCase.findMany({
    where: {
      organisationId: ctx.org.id,
      ...(impactedIds.length ? { id: { in: impactedIds } } : modules.length ? { module: { in: modules } } : {}),
    },
    orderBy: [{ criticality: "asc" }, { createdAt: "desc" }],
    take: 10,
  });

  // PR-specific cases make the deployed-URL coverage reproducible across runs.
  const titlePrefix = `PR #${pr.prNumber} ·`;
  const existingPrCases = await prisma.testCase.findMany({
    where: { organisationId: ctx.org.id, title: { startsWith: titlePrefix } },
    orderBy: { createdAt: "asc" },
  });

  const createdTestCases: Array<{ id: string; title: string; testType: string }> = [];
  if (input.createTests !== false && existingPrCases.length === 0) {
    const module = modules[0] || existingByModule[0]?.module || "Regression";
    const definitions = [
      {
        title: `${titlePrefix} Smoke check on ${environment?.name ?? "deployed environment"}`,
        testType: "Smoke",
        criticality: "high",
        stepsCount: 4,
      },
      {
        title: `${titlePrefix} Regression flow`,
        testType: "Regression",
        criticality: "high",
        stepsCount: 6,
      },
    ];
    for (const definition of definitions) {
      const created = await prisma.testCase.create({
        data: {
          organisationId: ctx.org.id,
          title: definition.title,
          module,
          criticality: definition.criticality,
          status: "passing",
          stepsCount: definition.stepsCount,
          source: "manual",
          stepsJson: buildStepsJson(targetUrl, definition.stepsCount, module, definition.title),
          variablesJson: JSON.stringify({
            url: targetUrl,
            _testType: definition.testType,
            _prId: pr.id,
            _prNumber: pr.prNumber,
            _environmentId: environment?.id ?? null,
          }),
        },
      });
      createdTestCases.push({ id: created.id, title: created.title, testType: definition.testType });
    }
  }

  const casesToRun = [...existingByModule, ...(existingPrCases.length > 0 ? existingPrCases : [])];
  if (createdTestCases.length > 0) {
    const created = await prisma.testCase.findMany({
      where: { id: { in: createdTestCases.map((test) => test.id) } },
    });
    casesToRun.push(...created);
  }

  // De-duplicate while preserving the impacted-first ordering.
  const uniqueCases = [...new Map(casesToRun.map((test) => [test.id, test])).values()];
  if (uniqueCases.length === 0) {
    return jsonError("No impacted or PR-specific test cases are available to run.", 400);
  }

  const run = await runTestCases(prisma, ctx, uniqueCases, {
    targetUrl,
    trigger: `PR #${pr.prNumber}`,
    mode: `PR Auto-Regression · ${environment?.name ?? "Deployed environment"}`,
    deterministic: true,
  });

  const regressions = run.failed;
  const status = regressions > 0 ? "regression_caught" : "passed_baseline";
  const now = new Date();
  const logs = parseJson<Array<{ at: string; level: string; message: string }>>(pr.logsJson, []);
  logs.push(
    {
      at: now.toISOString(),
      level: "info",
      message: `Auto-regression started against ${targetUrl} (${environment?.name ?? "default environment"}).`,
    },
    {
      at: now.toISOString(),
      level: regressions > 0 ? "error" : "success",
      message: `${run.total} test(s) executed · ${run.passed} passed · ${run.failed} failed · screenshots persisted per step.`,
    },
  );

  const autoRegression = {
    environmentId: environment?.id ?? null,
    environmentName: environment?.name ?? "Default environment",
    targetUrl,
    createdTestCases,
    testCaseIds: uniqueCases.map((test) => test.id),
    executed: run.results,
    passed: run.passed,
    failed: run.failed,
    total: run.total,
    regressions,
    ranAt: now.toISOString(),
  };

  const updated = await prisma.pullRequestCheck.update({
    where: { id: pr.id },
    data: {
      status,
      testsRun: run.total,
      regressions,
      impactJson: JSON.stringify({ ...impact, autoRegression }),
      logsJson: JSON.stringify(logs.slice(-80)),
    },
  });

  await audit(
    prisma,
    ctx,
    "pr.auto_regression",
    `#${pr.prNumber} · ${environment?.name ?? "default"} · ${run.passed}/${run.total} passed · ${regressions} regression(s)`,
  );

  return NextResponse.json(
    {
      prId: pr.id,
      status,
      environment: environment ? { id: environment.id, name: environment.name, baseUrl: environment.baseUrl } : null,
      targetUrl,
      createdTestCases,
      executed: run.results,
      passed: run.passed,
      failed: run.failed,
      total: run.total,
      regressions,
      testsRun: updated.testsRun,
      logs: logs.slice(-20),
      ranAt: now.toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
