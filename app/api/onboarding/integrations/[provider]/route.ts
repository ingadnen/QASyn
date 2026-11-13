import { NextResponse } from "next/server";
import { fetchAzureRepositories, isLiveAzurePat, parseAzureDevOpsUrl, resolveAzureDevOpsConfig } from "@/lib/azure-devops";
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

class IntegrationProbeRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationProbeRejectedError";
  }
}

function isSandboxHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".local") ||
    hostname === "example.com" ||
    hostname.endsWith(".example.com")
  );
}

function validHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isSandboxToken(value: string): boolean {
  const token = value.trim().toLowerCase();
  if (!token) return true;
  return /^(demo|test|sample|fake|dummy|placeholder|token)([-_].*)?$/.test(token) || /replace|your[-_]|x{4,}/.test(token);
}

async function probeJira(config: Record<string, string>): Promise<{ ok: boolean; detail: string; rejected?: boolean }> {
  const baseUrl = String(config.baseUrl ?? "").trim().replace(/\/+$/, "");
  const url = validHttpUrl(baseUrl);
  if (!url) return { ok: false, detail: "Enter a valid Jira base URL." };
  if (!String(config.email ?? "").trim() || !String(config.apiToken ?? "").trim()) {
    return { ok: false, detail: "Jira e-mail and API token are required." };
  }
  if (isSandboxHost(url.hostname) || isSandboxToken(config.apiToken)) {
    return { ok: true, detail: "Sandbox Jira configuration validated locally." };
  }
  try {
    const response = await fetch(`${baseUrl}/rest/api/3/myself`, {
      headers: {
        accept: "application/json",
        authorization: `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(6_000),
    });
    if (response.ok) return { ok: true, detail: `Jira verified as ${config.email}.` };
    const rejected = response.status === 401 || response.status === 403;
    return { ok: false, detail: rejected ? `Jira rejected the credentials (HTTP ${response.status}).` : `Jira probe returned HTTP ${response.status}; saved for offline validation.`, rejected };
  } catch {
    return { ok: false, detail: "Jira probe unavailable; saved for offline validation." };
  }
}

async function probeLinear(config: Record<string, string>): Promise<{ ok: boolean; detail: string; rejected?: boolean }> {
  const apiKey = String(config.apiKey ?? "").trim();
  if (!apiKey) return { ok: false, detail: "Linear API key is required." };
  if (!apiKey.startsWith("lin_api_")) return { ok: false, detail: "Linear API keys start with lin_api_." };
  if (isSandboxToken(apiKey)) return { ok: true, detail: "Sandbox Linear credentials validated locally." };
  try {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: apiKey },
      body: JSON.stringify({ query: "{ viewer { id name } }" }),
      signal: AbortSignal.timeout(6_000),
    });
    if (response.ok) return { ok: true, detail: "Linear viewer verified." };
    const rejected = response.status === 401 || response.status === 403;
    return { ok: false, detail: rejected ? `Linear rejected the credentials (HTTP ${response.status}).` : `Linear probe returned HTTP ${response.status}; saved for offline validation.`, rejected };
  } catch {
    return { ok: false, detail: "Linear probe unavailable; saved for offline validation." };
  }
}

function validateSlack(config: Record<string, string>): string | null {
  const webhook = String(config.webhookUrl ?? "").trim();
  const botToken = String(config.botToken ?? "").trim();
  if (webhook) {
    const url = validHttpUrl(webhook);
    if (!url || url.protocol !== "https:") return "Slack webhook must be a valid HTTPS URL.";
    return null;
  }
  if (botToken) {
    if (!botToken.startsWith("xoxb-")) return "Slack bot tokens start with xoxb-.";
    return null;
  }
  return "Provide a Slack webhook URL or bot token.";
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
      if ((response.status === 401 || response.status === 403) && !isSandboxToken(config.token)) {
        throw new IntegrationProbeRejectedError(`GitHub rejected the access token (HTTP ${response.status}).`);
      }
    }
    if (provider === "AZURE_DEVOPS") {
      const parsed = parseAzureDevOpsUrl(config.organization || config.baseUrl || "");
      const pat = String(config.token || config.pat || "").trim();
      if (parsed.organization && isLiveAzurePat(pat)) {
        const adoConfig = resolveAzureDevOpsConfig({
          ...config,
          organization: config.organization || parsed.orgUrl,
          project: config.project || parsed.project,
          pat,
        });
        try {
          const repositories = await fetchAzureRepositories(adoConfig);
          if (repositories.length > 0) {
            return repositories.map((repository) => ({
              id: repository.id,
              name: repository.name,
              fullName: `${adoConfig.organization}/${repository.name}`,
              url: repository.webUrl,
            }));
          }
        } catch (error) {
          const status = (error as { status?: number }).status;
          if ((status === 401 || status === 403) && !isSandboxToken(pat)) {
            throw new IntegrationProbeRejectedError(`Azure DevOps rejected the personal access token (HTTP ${status}).`);
          }
        }
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
      if ((response.status === 401 || response.status === 403) && !isSandboxToken(config.token)) {
        throw new IntegrationProbeRejectedError(`GitLab rejected the access token (HTTP ${response.status}).`);
      }
    }
  } catch (error) {
    if (error instanceof IntegrationProbeRejectedError) throw error;
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

  let verification = { ok: true, detail: "", tested: false };
  if (provider.data === "AZURE_DEVOPS") {
    const parsed = parseAzureDevOpsUrl(config.organization || config.baseUrl || "");
    if (!parsed.organization) return jsonError("Enter a valid Azure DevOps organization URL.", 400);
    if (!String(config.token || config.pat || "").trim()) return jsonError("Azure DevOps personal access token is required.", 400);
    verification = { ok: true, detail: `Azure DevOps organization ${parsed.organization} validated.`, tested: isLiveAzurePat(config.token || config.pat) };
  } else if (provider.data === "JIRA") {
    const url = validHttpUrl(String(config.baseUrl ?? "").trim());
    if (!url) return jsonError("Enter a valid Jira base URL.", 400);
    if (!String(config.email ?? "").trim()) return jsonError("Jira account e-mail is required.", 400);
    if (!String(config.apiToken ?? "").trim()) return jsonError("Jira API token is required.", 400);
    const probe = await probeJira(config);
    if (probe.rejected) return jsonError("Jira rejected the credentials. Check the account e-mail and API token.", 400);
    verification = { ...probe, tested: true };
  } else if (provider.data === "LINEAR") {
    if (!String(config.apiKey ?? "").trim()) return jsonError("Linear API key is required.", 400);
    const probe = await probeLinear(config);
    if (probe.rejected) return jsonError("Linear rejected the credentials. Check the API key.", 400);
    verification = { ...probe, tested: true };
  } else if (provider.data === "SLACK") {
    const slackError = validateSlack(config);
    if (slackError) return jsonError(slackError, 400);
    verification = { ok: true, detail: "Slack destination validated.", tested: true };
  }

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

  let repositories: RepoResult[] = [];
  if (provider.data === "GITHUB" || provider.data === "GITLAB" || provider.data === "AZURE_DEVOPS") {
    try {
      repositories = await fetchRepositories(provider.data, config);
    } catch (error) {
      if (error instanceof IntegrationProbeRejectedError) return jsonError(error.message, 400);
      throw error;
    }
  }

  const integration = await prisma.integration.upsert({
    where: { organisationId_provider: { organisationId: ctx.org.id, provider: provider.data } },
    create: { organisationId: ctx.org.id, provider: provider.data, status, detail: provider.data === "SLACK" ? `#${config.channel || `${ctx.org.slug}-qa`}`.replace(/^#/, "#") : detail, configJson: JSON.stringify(config) },
    update: { status, detail: provider.data === "SLACK" ? `#${config.channel || `${ctx.org.slug}-qa`}`.replace(/^#/, "#") : detail, configJson: JSON.stringify(config) },
  });
  await audit(prisma, ctx, "integration.connected", meta.name);
  return NextResponse.json({
    integration: { provider: integration.provider, status: integration.status, detail: integration.detail, config },
    repositories,
    tested: verification.tested,
    verification: verification.detail,
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
