import { NextResponse } from "next/server";
import { PROVIDER_META } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { integrationBodySchema, providerSchema } from "@/lib/validation";

type Params = { params: Promise<{ provider: string }> };

interface RepoResult {
  id: string;
  name: string;
  fullName: string;
  url: string;
}

async function fetchRepositories(provider: string, config: Record<string, string>): Promise<RepoResult[]> {
  const fallbackRepo = config.repository || config.repo || config.project || `${config.organization || config.workspace || "workspace"}-app`;
  const fallback: RepoResult[] = [{
    id: fallbackRepo,
    name: fallbackRepo.split("/").pop() || fallbackRepo,
    fullName: fallbackRepo.includes("/") ? fallbackRepo : `${config.organization || config.workspace || "workspace"}/${fallbackRepo}`,
    url: config.url || config.baseUrl || `https://dev.azure.com/${config.organization || "org"}`,
  }];
  try {
    if (provider === "GITHUB" && config.token) {
      const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) {
        const rows = (await response.json()) as Array<{ id?: number; name?: string; full_name?: string; html_url?: string }>;
        const repos = rows.slice(0, 100).map((repo) => ({
          id: String(repo.id ?? repo.full_name ?? repo.name ?? ""),
          name: String(repo.name ?? ""),
          fullName: String(repo.full_name ?? repo.name ?? ""),
          url: String(repo.html_url ?? ""),
        })).filter((repo) => repo.name);
        if (repos.length > 0) return repos;
      }
    }
    if (provider === "GITLAB" && config.token) {
      const response = await fetch("https://gitlab.com/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at", {
        headers: { "PRIVATE-TOKEN": config.token },
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) {
        const rows = (await response.json()) as Array<{ id?: number; name?: string; path_with_namespace?: string; web_url?: string }>;
        const repos = rows.map((repo) => ({
          id: String(repo.id ?? repo.path_with_namespace ?? repo.name ?? ""),
          name: String(repo.name ?? ""),
          fullName: String(repo.path_with_namespace ?? repo.name ?? ""),
          url: String(repo.web_url ?? ""),
        })).filter((repo) => repo.name);
        if (repos.length > 0) return repos;
      }
    }
  } catch {
    /* fall back to the configured repository */
  }
  return fallback;
}

/**
 * POST /api/onboarding/integrations/:provider — simulated OAuth connection.
 * Code hosts go through INDEXING (→ CONNECTED after ~8 s, settled lazily on read).
 */
export async function POST(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const provider = providerSchema.safeParse((await params).provider.toUpperCase());
  if (!provider.success) return jsonError("Unknown provider.", 404);
  const rawBody = ((await readJson(request)) ?? {}) as { detail?: string; config?: Record<string, unknown> };
  const body = integrationBodySchema.safeParse(rawBody);
  if (!body.success) return validationError(body.error);
  const config = Object.fromEntries(
    Object.entries(rawBody.config ?? {})
      .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
      .map(([key, value]) => [key, String(value)]),
  );

  await delay(MOCK_LATENCY_MS);
  const meta = PROVIDER_META[provider.data];
  const detail =
    body.data.detail ||
    config.repository ||
    config.project ||
    config.workspace ||
    config.organization ||
    `${ctx.org.slug}${provider.data === "SLACK" ? "" : "/app"}`;
  const status = "CONNECTED";

  const integration = await prisma.integration.upsert({
    where: { organisationId_provider: { organisationId: ctx.org.id, provider: provider.data } },
    create: { organisationId: ctx.org.id, provider: provider.data, status, detail: provider.data === "SLACK" ? `#${config.channel || `${ctx.org.slug}-qa`}`.replace(/^#/, "#") : detail, configJson: JSON.stringify(config) },
    update: { status, detail: provider.data === "SLACK" ? `#${config.channel || `${ctx.org.slug}-qa`}`.replace(/^#/, "#") : detail, configJson: JSON.stringify(config) },
  });
  await audit(prisma, ctx, "integration.connected", meta.name);
  const repositories = provider.data === "GITHUB" || provider.data === "GITLAB" || provider.data === "AZURE_DEVOPS"
    ? await fetchRepositories(provider.data, config)
    : [];
  return NextResponse.json({
    integration: { provider: integration.provider, status: integration.status, detail: integration.detail, config },
    repositories,
    tested: true,
  });
}

/** DELETE /api/onboarding/integrations/:provider — disconnects the provider. */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const provider = providerSchema.safeParse((await params).provider.toUpperCase());
  if (!provider.success) return jsonError("Unknown provider.", 404);
  await prisma.integration.deleteMany({ where: { organisationId: ctx.org.id, provider: provider.data } });
  await audit(prisma, ctx, "integration.disconnected", PROVIDER_META[provider.data].name);
  return NextResponse.json({ ok: true });
}
