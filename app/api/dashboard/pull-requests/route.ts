import { NextResponse } from "next/server";
import { z } from "zod";
import { isLiveAzurePat, postAzurePullRequestComment, resolveAzureDevOpsConfig } from "@/lib/azure-devops";
import { CREDIT_COSTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { riskFromFiles } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { parseIntegrationConfig } from "@/lib/integration-providers";
import { analyzePullRequest } from "@/lib/pr-analysis";
import {
  discoverPullRequests,
  parseCustomPrUrl,
  prDetail,
  type CatalogPullRequest,
} from "@/lib/pr-catalog";
import { assertQuotaAvailable, audit, guardApi, quotaErrorResponse, spendCredits } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { createPrSchema } from "@/lib/validation";

const MANUAL_FILES = [
  "src/core/app.ts",
  "src/auth/session.ts",
  "src/checkout/checkout-session.ts",
  "src/billing/invoice.ts",
  "src/settings/team/page.tsx",
  "src/api/dashboard/route.ts",
  "src/ui/components/Button.tsx",
  "src/ui/modal.tsx",
  "src/core/router.ts",
  "src/billing/proration.ts",
];

function manualFiles(count: number): string[] {
  return Array.from({ length: Math.min(Math.max(1, count), 40) }, (_, index) => {
    const base = MANUAL_FILES[index % MANUAL_FILES.length];
    return index < MANUAL_FILES.length ? base : base.replace(/(\.[a-z]+)$/, `-${index}$1`);
  });
}

/** Posts the generated verdict to an Azure DevOps PR thread when a real PAT exists. */
async function postAzureCommentForPullRequest(
  organisationId: string,
  pr: { provider: string | null; repository: string | null; prNumber: number; commentBody: string | null; commentPosted: boolean },
): Promise<boolean> {
  if (pr.provider !== "Azure DevOps" && pr.provider !== "AZURE_DEVOPS") return pr.commentPosted;
  const integration = await prisma.integration.findUnique({
    where: { organisationId_provider: { organisationId, provider: "AZURE_DEVOPS" } },
  });
  if (!integration || !pr.commentBody) return false;
  const config = resolveAzureDevOpsConfig(parseIntegrationConfig(integration.configJson));
  if (!isLiveAzurePat(config.pat)) return false;
  const published = await postAzurePullRequestComment(config, pr.repository ?? "", pr.prNumber, pr.commentBody);
  return published.posted;
}

export async function GET() {
  const guard = await guardPermission("pullRequests");
  if (!guard.ok) return guard.response;
  const pullRequests = await prisma.pullRequestCheck.findMany({
    where: { organisationId: guard.ctx.org.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ pullRequests: pullRequests.map(prDetail) });
}

/** POST /api/dashboard/pull-requests — analyse a connected PR or a manual/custom one. */
export async function POST(request: Request) {
  const guard = await guardPermission("prRun", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = createPrSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  let provider: string | null = null;
  let repository: string | null = null;
  let externalUrl: string | null = null;
  let branchTarget = "main";
  let selected: CatalogPullRequest | undefined;
  let title: string;
  let branch: string;
  let author: string;
  let files: string[];

  if ("mode" in input && input.mode === "catalog") {
    const integrations = await prisma.integration.findMany({
      where: { organisationId: ctx.org.id, status: "CONNECTED", provider: input.provider },
    });
    const sources = await discoverPullRequests(
      integrations.map((integration) => ({
        provider: integration.provider,
        status: integration.status,
        config: parseIntegrationConfig(integration.configJson),
      })),
    );
    const source = sources.find((item) => item.repository === input.repository);
    if (!source) return jsonError("This repository is not connected. Configure it in Integrations first.", 422);
    selected = source.pullRequests.find((item) => item.number === input.prNumber);
    if (!selected) return jsonError("Pull request not found in the connected repository.", 404);
    provider = selected.provider;
    repository = selected.repository;
    externalUrl = selected.url;
    branchTarget = selected.branchTarget;
    title = selected.title;
    branch = selected.branch;
    author = selected.author;
    files = selected.files;
  } else if ("mode" in input && input.mode === "custom") {
    const parsedUrl = parseCustomPrUrl(input.url);
    if (!parsedUrl) return jsonError("Enter a GitHub, GitLab, Bitbucket or Azure DevOps pull request URL.", 422);
    provider = parsedUrl.provider;
    repository = parsedUrl.repository;
    externalUrl = input.url.trim();
    title = `Custom pull request #${parsedUrl.prNumber}`;
    branch = `pr-${parsedUrl.prNumber}`;
    author = "external";
    files = manualFiles(3);
    selected = {
      provider,
      repository,
      number: parsedUrl.prNumber,
      title,
      branch,
      branchTarget,
      author,
      openedAt: new Date().toISOString(),
      files,
      additions: 0,
      deletions: 0,
      url: externalUrl,
    };
  } else {
    const parsedUrl = input.customUrl ? parseCustomPrUrl(input.customUrl) : null;
    provider = parsedUrl?.provider ?? null;
    repository = parsedUrl?.repository ?? null;
    externalUrl = input.customUrl?.trim() || null;
    title = input.title;
    branch = input.branch;
    author = input.author;
    files = manualFiles(input.filesChanged);
  }

  const prNumber = "mode" in input && input.mode === "catalog" ? input.prNumber : "mode" in input && input.mode === "custom" ? parseCustomPrUrl(input.url)!.prNumber : input.prNumber;

  const exists = await prisma.pullRequestCheck.findUnique({
    where: { organisationId_prNumber: { organisationId: ctx.org.id, prNumber } },
  });
  if (exists) return jsonError(`PR #${prNumber} has already been checked.`, 409);

  try {
    await assertQuotaAvailable(prisma, ctx.org.id, CREDIT_COSTS.prAnalysis, ctx.user.id);
  } catch (error) {
    const quota = quotaErrorResponse(error);
    if (quota) return quota;
    throw error;
  }

  await delay(MOCK_LATENCY_MS);

  const created = await prisma.pullRequestCheck.create({
    data: {
      organisationId: ctx.org.id,
      prNumber,
      title,
      branch,
      branchTarget,
      author,
      provider,
      repository,
      externalUrl,
      status: "running",
      riskLevel: riskFromFiles(files.length),
      filesChanged: files.length,
      changedFilesJson: JSON.stringify(files),
    },
  });

  try {
    await spendCredits(prisma, ctx.org.id, CREDIT_COSTS.prAnalysis, ctx.user.id);
    let analyzed = await analyzePullRequest(created, ctx);
    const commentPosted = await postAzureCommentForPullRequest(ctx.org.id, analyzed);
    if (commentPosted !== analyzed.commentPosted) {
      analyzed = await prisma.pullRequestCheck.update({ where: { id: analyzed.id }, data: { commentPosted } });
    }
    await audit(prisma, ctx, "pull_request.checked", `#${prNumber} ${title}`);
    return NextResponse.json({ pullRequest: prDetail(analyzed), detail: prDetail(analyzed) }, { status: 201 });
  } catch (error) {
    const quota = quotaErrorResponse(error);
    if (quota) return quota;
    throw error;
  }
}

const rerunSchema = z.object({ id: z.string().min(1).max(60) });

/** PATCH /api/dashboard/pull-requests — re-runs the analysis for one pull request. */
export async function PATCH(request: Request) {
  const guard = await guardPermission("prRun", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = rerunSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const pr = await prisma.pullRequestCheck.findFirst({ where: { id: parsed.data.id, organisationId: ctx.org.id } });
  if (!pr) return jsonError("Pull request not found.", 404);

  if (!pr.changedFilesJson || pr.changedFilesJson === "[]") {
    await prisma.pullRequestCheck.update({
      where: { id: pr.id },
      data: { changedFilesJson: JSON.stringify(manualFiles(pr.filesChanged)) },
    });
  }

  try {
    await assertQuotaAvailable(prisma, ctx.org.id, CREDIT_COSTS.prAnalysis, ctx.user.id);
  } catch (error) {
    const quota = quotaErrorResponse(error);
    if (quota) return quota;
    throw error;
  }

  await delay(MOCK_LATENCY_MS);
  try {
    let updated = await analyzePullRequest(pr, ctx);
    const commentPosted = await postAzureCommentForPullRequest(ctx.org.id, updated);
    if (commentPosted !== updated.commentPosted) {
      updated = await prisma.pullRequestCheck.update({ where: { id: updated.id }, data: { commentPosted } });
    }
    await spendCredits(prisma, ctx.org.id, CREDIT_COSTS.prAnalysis, ctx.user.id);
    await audit(prisma, ctx, "pull_request.reanalysed", `#${pr.prNumber} ${pr.title}`);
    return NextResponse.json({ pullRequest: prDetail(updated), detail: prDetail(updated) });
  } catch (error) {
    const quota = quotaErrorResponse(error);
    if (quota) return quota;
    throw error;
  }
}
