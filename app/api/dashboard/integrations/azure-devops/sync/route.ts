import { NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchAzureDevOpsSnapshot,
  isLiveAzurePat,
  mirrorAzureDevOpsSnapshot,
  parseAzureDevOpsUrl,
  postAzurePullRequestComment,
  resolveAzureDevOpsConfig,
  type AzureDevOpsSnapshot,
  type AzureTestCase,
} from "@/lib/azure-devops";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { parseIntegrationConfig } from "@/lib/integration-providers";
import { guardAnyPermission } from "@/lib/rbac-server";
import { audit } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const syncSchema = z.object({
  direction: z.enum(["pull", "push", "both"]).default("both"),
  baseUrl: z.string().trim().max(600).optional(),
  project: z.string().trim().max(200).optional(),
  token: z.string().trim().max(600).optional(),
  repository: z.string().trim().max(300).optional(),
  mode: z.enum(["live", "mirror", "demo"]).optional(),
});

const MIRROR_BASE = "https://dev.azure.com/ai-test-automations";
const MIRROR_PROJECT = "AI Test Automation";
const MIRROR_REPOSITORY = "AI Test Automation";

function inferTestType(title: string): string {
  const text = title.toLowerCase();
  if (/javascript|console|missing resource|security|error/.test(text)) return "Security";
  if (/performance|load time|latency/.test(text)) return "Performance";
  if (/api|endpoint|integration/.test(text)) return "API";
  if (/accessib|responsive|mobile|cross-device|screen|orientation|keyboard/.test(text)) return "Accessibility";
  if (/cross-browser|end-to-end|journey/.test(text)) return "End-to-End (E2E)";
  if (/navigation|footer|call-to-action|cta|button|menu|search|login|auth/.test(text)) return "Regression";
  if (/landing|page loads|initial|visibility/.test(text)) return "Smoke";
  return "Functional";
}

function criticalityForPriority(priority: number): string {
  if (priority <= 1) return "critical";
  if (priority === 2) return "high";
  if (priority === 3) return "medium";
  return "low";
}

function riskForFiles(count: number): string {
  if (count >= 10) return "high";
  if (count >= 4) return "medium";
  return "low";
}

function parseLabelArray(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function parseVariableObject(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

interface SyncCounts {
  pullRequests: number;
  workItems: number;
  testPlans: number;
  testSuites: number;
  testCases: number;
}

async function pullAzureDevOps(
  organisationId: string,
  actorOrgWebsite: string | null,
  snapshot: AzureDevOpsSnapshot,
): Promise<{ counts: SyncCounts; pushedComments: number }> {
  const targetUrl = (actorOrgWebsite || "https://www.cgi.com").trim() || "https://www.cgi.com";
  const counts: SyncCounts = {
    pullRequests: snapshot.pullRequests.length,
    workItems: snapshot.workItems.length,
    testPlans: snapshot.plans.length,
    testSuites: snapshot.plans.reduce((total, plan) => total + plan.suites.length, 0),
    testCases: 0,
  };

  const uniqueCases = new Map<number, AzureTestCase>();
  for (const plan of snapshot.plans) {
    for (const suite of plan.suites) {
      for (const testCase of suite.testCases) uniqueCases.set(testCase.id, testCase);
    }
  }
  counts.testCases = uniqueCases.size;

  const existingCases = await prisma.testCase.findMany({
    where: { organisationId },
    select: { id: true, title: true, variablesJson: true, labelsJson: true, status: true },
  });
  const existingByAdo = new Map<string, (typeof existingCases)[number]>();
  const existingByTitle = new Map<string, (typeof existingCases)[number]>();
  for (const testCase of existingCases) {
    const adoId = parseVariableObject(testCase.variablesJson)._adoId;
    if (adoId != null) existingByAdo.set(String(adoId), testCase);
    existingByTitle.set(testCase.title.trim().toLowerCase(), testCase);
  }

  const importedCaseIds = new Map<number, string>();
  const importedCaseRows: string[] = [];
  for (const testCase of uniqueCases.values()) {
    const match =
      existingByAdo.get(String(testCase.id)) ??
      existingByTitle.get(testCase.title.trim().toLowerCase()) ??
      null;
    const labels = [...new Set([...parseLabelArray(match?.labelsJson), "azure-devops", `ado-${testCase.id}`])];
    const variables = {
      ...parseVariableObject(match?.variablesJson),
      url: targetUrl,
      _testType: inferTestType(testCase.title),
      _adoId: testCase.id,
      _adoPlanId: snapshot.plans.find((plan) => plan.suites.some((suite) => suite.testCases.some((item) => item.id === testCase.id)))?.id ?? null,
      _adoSuiteId: snapshot.plans.flatMap((plan) => plan.suites).find((suite) => suite.testCases.some((item) => item.id === testCase.id))?.id ?? null,
      _adoOrganization: snapshot.organization,
      _adoProject: snapshot.project,
    };
    const data = {
      title: testCase.title,
      module: "Azure DevOps",
      description:
        testCase.description ||
        `Imported from Azure DevOps Test Case #${testCase.id} · ${snapshot.project}`,
      labelsJson: JSON.stringify(labels),
      criticality: criticalityForPriority(testCase.priority),
      environment: "Production",
      version: "1.0",
      platform: "web",
      stepsCount: testCase.steps.length,
      stepsJson: JSON.stringify(testCase.steps),
      assertionsJson: JSON.stringify(
        testCase.steps.map((step) => ({ stepId: step.id, expectedResult: step.expectedResult ?? "" })),
      ),
      variablesJson: JSON.stringify(variables),
      source: "ai",
    };
    const saved = match
      ? await prisma.testCase.update({ where: { id: match.id }, data })
      : await prisma.testCase.create({ data: { organisationId, status: "draft", ...data } });
    importedCaseIds.set(testCase.id, saved.id);
    importedCaseRows.push(saved.id);
  }

  const importedIds = [...new Set(importedCaseRows)];

  // Boards Work Items → Requirements (ADO-<id>).
  for (const workItem of snapshot.workItems) {
    await prisma.requirement.upsert({
      where: { organisationId_code: { organisationId, code: `ADO-${workItem.id}` } },
      create: {
        organisationId,
        code: `ADO-${workItem.id}`,
        title: workItem.title,
        source: "azure_devops",
        coverageStatus: importedIds.length > 0 ? "covered" : "uncovered",
        linkedTestsCount: importedIds.length,
        testCases: { connect: importedIds.map((id) => ({ id })) },
      },
      update: {
        title: workItem.title,
        source: "azure_devops",
        coverageStatus: importedIds.length > 0 ? "covered" : "uncovered",
        linkedTestsCount: importedIds.length,
        testCases: { set: importedIds.map((id) => ({ id })) },
      },
    });
  }

  // Azure Test Suites → QASyn Test Suites.
  const suiteIds = new Map<number, string>();
  for (const plan of snapshot.plans) {
    for (const suite of plan.suites) {
      const suiteName = `${suite.name} (ADO #${suite.id})`;
      const linkedIds = [...new Set(suite.testCases.map((testCase) => importedCaseIds.get(testCase.id)).filter(Boolean))] as string[];
      const existing = await prisma.testSuite.findFirst({ where: { organisationId, name: suiteName }, select: { id: true } });
      const data = {
        name: suiteName,
        description: `Imported from Azure DevOps Test Suite #${suite.id} · Plan #${plan.id} · ${snapshot.project}`,
        schedule: "manual",
        module: "Azure DevOps",
        platform: "Web",
        labelsJson: JSON.stringify(["azure-devops", `ado-suite-${suite.id}`]),
        testCasesCount: linkedIds.length,
      };
      const saved = existing
        ? await prisma.testSuite.update({
            where: { id: existing.id },
            data: { ...data, testCases: { set: linkedIds.map((id) => ({ id })) } },
          })
        : await prisma.testSuite.create({
            data: { organisationId, ...data, testCases: { connect: linkedIds.map((id) => ({ id })) } },
          });
      suiteIds.set(suite.id, saved.id);
    }
  }

  // Azure Test Plans → QASyn Test Plans (Plan → suites + cases).
  for (const plan of snapshot.plans) {
    const planName = `${plan.name} (ADO #${plan.id})`;
    const planSuiteIds = [...new Set(plan.suites.map((suite) => suiteIds.get(suite.id)).filter(Boolean))] as string[];
    const planCaseIds = [
      ...new Set(plan.suites.flatMap((suite) => suite.testCases.map((testCase) => importedCaseIds.get(testCase.id))).filter(Boolean)),
    ] as string[];
    const existing = await prisma.testPlan.findFirst({ where: { organisationId, name: planName }, select: { id: true } });
    const data = {
      name: planName,
      description: plan.description || `Imported from Azure DevOps Test Plan #${plan.id} · ${snapshot.project}`,
      schedule: "manual",
      module: "Azure DevOps",
      environment: "Production",
      browsersJson: JSON.stringify(["Chromium"]),
      testCasesCount: planCaseIds.length,
    };
    if (existing) {
      await prisma.testPlan.update({
        where: { id: existing.id },
        data: {
          ...data,
          suites: { set: planSuiteIds.map((id) => ({ id })) },
          testCases: { set: planCaseIds.map((id) => ({ id })) },
        },
      });
    } else {
      await prisma.testPlan.create({
        data: {
          organisationId,
          ...data,
          suites: { connect: planSuiteIds.map((id) => ({ id })) },
          testCases: { connect: planCaseIds.map((id) => ({ id })) },
        },
      });
    }
  }

  // Azure Repos Pull Requests → PullRequestCheck.
  for (const pull of snapshot.pullRequests) {
    const files = pull.changedFiles.length > 0 ? pull.changedFiles : ["src/README.md"];
    const existing = await prisma.pullRequestCheck.findUnique({
      where: { organisationId_prNumber: { organisationId, prNumber: pull.id } },
    });
    if (existing && existing.provider && !["Azure DevOps", "AZURE_DEVOPS", "AZURE"].includes(existing.provider)) {
      // Never hijack a GitHub/GitLab PR that happens to share a numeric id.
      continue;
    }
    const shared = {
      title: pull.title,
      branch: pull.sourceBranch,
      branchTarget: pull.targetBranch,
      author: pull.author,
      provider: "Azure DevOps",
      repository: pull.repository,
      externalUrl: pull.externalUrl,
      filesChanged: files.length,
      changedFilesJson: JSON.stringify(files),
      impactJson: JSON.stringify({
        source: "azure-devops",
        azureId: pull.id,
        azureStatus: pull.status,
        additions: pull.additions,
        deletions: pull.deletions,
      }),
    };
    if (existing) {
      await prisma.pullRequestCheck.update({ where: { id: existing.id }, data: shared });
    } else {
      await prisma.pullRequestCheck.create({
        data: {
          organisationId,
          prNumber: pull.id,
          status: "running",
          riskLevel: riskForFiles(files.length),
          ...shared,
        },
      });
    }
  }

  // Push stored QASyn verdicts for Azure PRs that have not been published yet.
  let pushedComments = 0;
  const integration = await prisma.integration.findUnique({
    where: { organisationId_provider: { organisationId, provider: "AZURE_DEVOPS" } },
  });
  const savedConfig = resolveAzureDevOpsConfig(parseIntegrationConfig(integration?.configJson ?? "{}"));
  if (isLiveAzurePat(savedConfig.pat)) {
    const pending = await prisma.pullRequestCheck.findMany({
      where: {
        organisationId,
        provider: "Azure DevOps",
        commentPosted: false,
        commentBody: { not: null },
      },
      take: 10,
    });
    for (const pull of pending) {
      if (!pull.commentBody) continue;
      const posted = await postAzurePullRequestComment(savedConfig, pull.repository ?? "", pull.prNumber, pull.commentBody);
      if (posted.posted) {
        await prisma.pullRequestCheck.update({ where: { id: pull.id }, data: { commentPosted: true } });
        pushedComments += 1;
      }
    }
  }

  return { counts, pushedComments };
}

/** POST /api/dashboard/integrations/azure-devops/sync — pull/push Azure DevOps. */
export async function POST(request: Request) {
  const guard = await guardAnyPermission(
    ["integrationsManage", "testCasesEdit", "plansEdit", "requirementsEdit"],
    { write: true },
  );
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = syncSchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  const existing = await prisma.integration.findUnique({
    where: { organisationId_provider: { organisationId: ctx.org.id, provider: "AZURE_DEVOPS" } },
  });
  const stored = parseIntegrationConfig(existing?.configJson ?? "{}");

  const rawBase =
    input.baseUrl?.trim() ||
    stored.baseUrl ||
    stored.organization ||
    MIRROR_BASE;
  const parsedBase = parseAzureDevOpsUrl(rawBase);
  const project = input.project?.trim() || stored.project || parsedBase.project || MIRROR_PROJECT;
  const parsedWithProject = parseAzureDevOpsUrl(
    parsedBase.project ? rawBase : `${parsedBase.orgUrl || rawBase}/${encodeURIComponent(project)}`,
  );
  const organization = parsedWithProject.organization || parsedBase.organization || "ai-test-automations";
  const orgUrl = parsedWithProject.orgUrl || parsedBase.orgUrl || MIRROR_BASE;
  const token = input.token?.trim() || stored.pat || "";
  // When a new base URL/project is supplied explicitly, do not keep a stale
  // repository from a previous workspace: the mirror/live snapshot chooses the
  // repository for the target project.
  const repository = input.repository?.trim() || (input.baseUrl || input.project ? "" : stored.repository || "");

  const config = {
    ...resolveAzureDevOpsConfig({
      ...stored,
      organization: orgUrl,
      baseUrl: orgUrl,
      project,
      pat: token,
      repository,
    }),
    pat: token,
    project,
    projectEncoded: encodeURIComponent(project),
    orgUrl,
    organization,
  };

  let snapshot: AzureDevOpsSnapshot;
  let mode: "live" | "mirror" = "mirror";
  const liveRequested = input.mode !== "mirror" && input.mode !== "demo" && isLiveAzurePat(token);
  if (liveRequested) {
    try {
      snapshot = await fetchAzureDevOpsSnapshot(config, ctx.org.website || "https://www.cgi.com");
      mode = "live";
    } catch {
      snapshot = mirrorAzureDevOpsSnapshot(config, ctx.org.website || "https://www.cgi.com");
      mode = "mirror";
    }
  } else {
    snapshot = mirrorAzureDevOpsSnapshot(config, ctx.org.website || "https://www.cgi.com");
  }

  try {
    const savedRepository =
      repository ||
      snapshot.repositories[0]?.name ||
      snapshot.pullRequests[0]?.repository ||
      MIRROR_REPOSITORY;
    const savedConfig = {
      ...stored,
      organization: orgUrl,
      baseUrl: orgUrl,
      project,
      repository: savedRepository,
      baseBranch: stored.baseBranch || "main",
      pat: token,
    };
    await prisma.integration.upsert({
      where: { organisationId_provider: { organisationId: ctx.org.id, provider: "AZURE_DEVOPS" } },
      create: {
        organisationId: ctx.org.id,
        provider: "AZURE_DEVOPS",
        status: "CONNECTED",
        detail: `${organization} / ${project}${savedRepository ? ` · ${savedRepository}` : ""}`,
        configJson: JSON.stringify(savedConfig),
        lastSyncAt: new Date(),
      },
      update: {
        status: "CONNECTED",
        detail: `${organization} / ${project}${savedRepository ? ` · ${savedRepository}` : ""}`,
        configJson: JSON.stringify(savedConfig),
        lastSyncAt: new Date(),
      },
    });

    let counts: SyncCounts = { pullRequests: 0, workItems: 0, testPlans: 0, testSuites: 0, testCases: 0 };
    let pushedComments = 0;
    if (input.direction !== "push") {
      const pulled = await pullAzureDevOps(ctx.org.id, ctx.org.website, snapshot);
      counts = pulled.counts;
      pushedComments = pulled.pushedComments;
    } else {
      const integration = await prisma.integration.findUnique({
        where: { organisationId_provider: { organisationId: ctx.org.id, provider: "AZURE_DEVOPS" } },
      });
      const pushConfig = resolveAzureDevOpsConfig(parseIntegrationConfig(integration?.configJson ?? "{}"));
      if (isLiveAzurePat(pushConfig.pat)) {
        const pending = await prisma.pullRequestCheck.findMany({
          where: { organisationId: ctx.org.id, provider: "Azure DevOps", commentPosted: false, commentBody: { not: null } },
          take: 10,
        });
        for (const pull of pending) {
          if (!pull.commentBody) continue;
          const posted = await postAzurePullRequestComment(pushConfig, pull.repository ?? "", pull.prNumber, pull.commentBody);
          if (posted.posted) {
            await prisma.pullRequestCheck.update({ where: { id: pull.id }, data: { commentPosted: true } });
            pushedComments += 1;
          }
        }
      }
    }

    await audit(
      prisma,
      ctx,
      "azure_devops.synced",
      `${mode} · ${organization}/${project} · ${counts.pullRequests} PRs · ${counts.workItems} work items · ${counts.testCases} cases`,
    );

    return NextResponse.json({
      ok: true,
      mode,
      organization,
      project,
      counts,
      pushedComments,
      emptyReposWarning: snapshot.emptyReposWarning,
      repositoriesFound: snapshot.repositories.length,
      emptyRepos: snapshot.repositories.filter((repo) => repo.empty).map((repo) => repo.name),
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    const caught = error as { message?: string };
    return jsonError(caught.message || "Azure DevOps synchronization failed.", 500);
  }
}
