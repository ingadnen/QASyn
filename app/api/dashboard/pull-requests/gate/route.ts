import { NextResponse } from "next/server";
import { z } from "zod";
import { biviaScoreAndSet } from "@/lib/bivia";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { parseIntegrationConfig } from "@/lib/integration-providers";
import { buildPrGateMarkdown, type PrGateBivia, type PrGateImpact } from "@/lib/pr-gate";
import { guardPermission } from "@/lib/rbac-server";
import { runStrixScan } from "@/lib/strix";
import { audit, readSettings } from "@/lib/tenant";
import { normalizeWebsite } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const gateSchema = z.object({ id: z.string().min(1).max(60) });

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value || "") as T;
  } catch {
    return fallback;
  }
}

function asBivia(value: unknown): PrGateBivia | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const riskScore = Number(record.riskScore);
  const probabilityPct = Number(record.probabilityPct);
  const riskLevel = record.riskLevel;
  if (!Number.isFinite(riskScore) || !Number.isFinite(probabilityPct)) return null;
  if (riskLevel !== "low" && riskLevel !== "medium" && riskLevel !== "high") return null;
  return {
    riskScore,
    probabilityPct,
    riskLevel,
    provider: typeof record.provider === "string" ? record.provider : "Articul8 Bivia",
  };
}

/**
 * POST /api/dashboard/pull-requests/gate { id }
 * Builds the copy-ready CI/CD gate comment: Bivia verdict + calibrated risk,
 * the `/set` impacted test table, and the Strix security summary.
 */
export async function POST(request: Request) {
  const guard = await guardPermission("prRun");
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = gateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const pr = await prisma.pullRequestCheck.findFirst({ where: { id: parsed.data.id, organisationId: ctx.org.id } });
  if (!pr) return jsonError("Pull request not found.", 404);

  const files = parseJson<string[]>(pr.changedFilesJson, []);
  const impact = parseJson<PrGateImpact>(pr.impactJson, {});
  let bivia = asBivia(impact.bivia);

  if (!bivia) {
    const candidateIds = (impact.impacted ?? []).map((test) => test.id).filter(Boolean);
    const candidates = await prisma.testCase.findMany({
      where: {
        organisationId: ctx.org.id,
        ...(candidateIds.length ? { id: { in: candidateIds } } : {}),
      },
      select: { id: true, title: true, module: true, criticality: true, status: true },
      take: 12,
    });
    const analysisCode = readSettings(ctx.org).analysisCode ?? null;
    let integrationConfig = null;
    try {
      const row = await prisma.integration.findUnique({
        where: { organisationId_provider: { organisationId: ctx.org.id, provider: "BIVIA" } },
        select: { configJson: true },
      });
      integrationConfig = row ? parseIntegrationConfig(row.configJson) : null;
    } catch {
      integrationConfig = null;
    }
    if (analysisCode?.biviaPrRisk !== false) {
      const decision = await biviaScoreAndSet({
        prTitle: pr.title,
        changedFiles: files,
        candidateTests: candidates,
        organisationId: ctx.org.id,
        sources: { integrationConfig, analysisCode },
      });
      bivia = {
        riskScore: Math.round(decision.riskScore * 10) / 10,
        riskLevel: decision.riskLevel,
        probabilityPct: Math.round(decision.probability * 1000) / 10,
        provider: decision.provider,
      };
      // Persist the calibrated gate inputs so the next preview is instant.
      await prisma.pullRequestCheck.update({
        where: { id: pr.id },
        data: { impactJson: JSON.stringify({ ...impact, bivia }) },
      });
    }
  }

  const targetUrl =
    normalizeWebsite(ctx.org.website ?? "") ??
    normalizeWebsite(pr.externalUrl ?? "") ??
    "https://www.cgi.com";
  const strix = await runStrixScan(targetUrl);

  const markdown = buildPrGateMarkdown({
    organisation: ctx.org.name,
    prNumber: pr.prNumber,
    title: pr.title,
    branch: pr.branch,
    branchTarget: pr.branchTarget,
    author: pr.author,
    provider: pr.provider,
    repository: pr.repository,
    filesChanged: pr.filesChanged,
    riskLevel: pr.riskLevel,
    files,
    impact,
    bivia,
    strix,
    targetUrl,
  });

  await audit(
    prisma,
    ctx,
    "pr.gate_generated",
    `#${pr.prNumber} · Bivia ${bivia ? `${bivia.riskScore.toFixed(1)}/10 (${bivia.probabilityPct.toFixed(1)}%)` : "fallback"} · Strix ${strix.grade}`,
  );

  return NextResponse.json(
    {
      prNumber: pr.prNumber,
      markdown,
      bivia,
      security: {
        grade: strix.grade,
        score: strix.score,
        reachable: strix.reachable,
        findings: strix.findings.filter((finding) => !finding.passed).length,
      },
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
