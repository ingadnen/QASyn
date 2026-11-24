/**
 * Phase 31 — real-time integration sync engine.
 *
 * One `runSyncPass` call sweeps every CONNECTED integration of an organisation
 * and turns provider activity into deduplicated notifications (in-app feed,
 * plus rule-matched Slack/Teams/email deliveries simulated locally):
 *
 * - GITHUB / GITLAB: pull requests → PullRequestCheck rows, auto PR impact
 *   analysis (existing `analyzePullRequest` pipeline), `pr.opened_or_updated`.
 * - JIRA: issues → Requirements, `jira.issue_synced`.
 * - CONFLUENCE: page updates → Knowledge Base, `docs.confluence_updated`.
 * - Every other provider: a simulated heartbeat so the badge and feed stay
 *   meaningful without live credentials (no outbound requests for those).
 *
 * Live providers use the credentials stored on the integration config, falling
 * back to the workspace environment (GITHUB_TOKEN, ATLASSIAN_API_TOKEN …).
 * Every live fetch is best-effort: on error the provider degrades to the
 * simulated path instead of failing the pass.
 */
import { prisma } from "@/lib/db";
import { analyzePullRequest } from "@/lib/pr-analysis";
import { matchesEvent, formatSlackMessage } from "@/lib/notifications";
import type { OrgContext } from "@/lib/tenant";
import { parseIntegrationConfig } from "@/lib/integration-providers";
import { planEntitlements } from "@/lib/entitlements";

export const SYNC_EVENT_TYPES = [
  "pr.opened_or_updated",
  "docs.confluence_updated",
  "jira.issue_synced",
  "test_run.failed_or_regression",
  "self_heal.applied",
  "autopilot.completed",
  "billing.low_credits",
] as const;

export interface SyncEvent {
  provider: string;
  eventType: string;
  title: string;
  body: string;
  linkUrl?: string;
  dedupeKey: string;
}

export interface ProviderSyncReport {
  provider: string;
  name: string;
  mode: "live" | "simulated";
  /** Human summary of what the pass did, shown in the sync log. */
  note: string;
  events: number;
  newEvents: number;
}

export interface SyncPassResult {
  organisationId: string;
  startedAt: string;
  durationMs: number;
  intervalSeconds: number;
  reports: ProviderSyncReport[];
  newNotifications: number;
}

type Actor = Pick<OrgContext, "org" | "user">;

interface IntegrationLike {
  provider: string;
  configJson: string;
  detail: string | null;
}

function configValue(config: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 8000): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Persists an event, skipping duplicates via the (organisationId, dedupeKey) unique key. */
async function recordEvent(
  organisationId: string,
  event: SyncEvent,
  actor: Actor,
): Promise<"created" | "duplicate"> {
  try {
    await prisma.notification.create({
      data: {
        organisationId,
        eventType: event.eventType,
        provider: event.provider,
        title: event.title,
        body: event.body,
        linkUrl: event.linkUrl,
        dedupeKey: event.dedupeKey,
      },
    });
  } catch {
    // Unique violation → we already notified about this item in an earlier pass.
    return "duplicate";
  }
  await dispatchChannels(organisationId, event, actor);
  return "created";
}

/** Matches the org's notification rules and performs the (locally simulated) channel delivery. */
async function dispatchChannels(organisationId: string, event: SyncEvent, actor: Actor) {
  const rules = await prisma.notificationRule.findMany({ where: { organisationId } });
  const matched = rules
    .filter((rule) => rule.enabled)
    .filter((rule) => matchesEvent(
      [{ channel: rule.channel, events: JSON.parse(rule.events || "[]") as string[], enabled: true }],
      event.eventType,
    ));
  for (const rule of matched) {
    const config = (() => {
      try {
        return JSON.parse(rule.configJson || "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    })();
    const message = formatSlackMessage(event.eventType, event.title, event.body);
    const recipient = typeof config.target === "string" ? config.target : rule.channel;
    await prisma.systemAuditLog.create({
      data: {
        actorEmail: actor.user?.email ?? "sync-engine",
        action: "notification.delivered",
        target: `${rule.channel} → ${recipient} · ${message}`,
        organisationId,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// GitHub / GitLab (pull requests → auto PR impact analysis)
// ---------------------------------------------------------------------------

interface ProviderPullRequest {
  number: number;
  title: string;
  state: string;
  draft?: boolean;
  html_url?: string;
  web_url?: string;
  user?: { login?: string } | null;
  author?: { username?: string } | null;
  head?: { ref?: string };
  source_branch?: string;
  base?: { ref?: string };
  target_branch?: string;
  created_at?: string;
  updated_at?: string;
}

/** Returns the repository configured on the integration ("owner/repo" or a GitLab full path). */
function repositoryFrom(config: Record<string, string>, detail: string | null): string | null {
  const value = configValue(config, "repository", "repo", "project", "projectPath");
  if (value && value.includes("/")) return value;
  if (detail) {
    const match = detail.match(/([\w.-]+\/[\w.-]+)/);
    if (match) return match[1];
  }
  return null;
}

async function syncGitProvider(
  actor: Actor,
  integration: IntegrationLike,
  provider: "GITHUB" | "GITLAB",
): Promise<ProviderSyncReport> {
  const config = parseIntegrationConfig(integration.configJson);
  const repository = repositoryFrom(config, integration.detail);
  const token =
    configValue(config, "token", "apiToken", "personalAccessToken", "pat") ??
    (provider === "GITHUB" ? process.env.GITHUB_TOKEN : undefined);
  const host = trimTrailingSlash(
    configValue(config, "url", "baseUrl", "host") ??
      (provider === "GITHUB" ? "https://api.github.com" : "https://gitlab.com/api/v4"),
  );

  let pullRequests: ProviderPullRequest[] = [];
  let mode: "live" | "simulated" = "live";
  if (repository && token) {
    const url =
      provider === "GITHUB"
        ? `${host}/repos/${repository}/pulls?state=all&per_page=10`
        : `${host}/projects/${encodeURIComponent(repository)}/merge_requests?state=all&per_page=10`;
    const data = await fetchJson(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    pullRequests = Array.isArray(data) ? (data as ProviderPullRequest[]) : [];
    if (pullRequests.length === 0) mode = "simulated";
  } else {
    mode = "simulated";
  }

  let created = 0;
  let analysed = 0;
  for (const pull of pullRequests) {
    const prNumber = pull.number;
    const branch = pull.head?.ref ?? pull.source_branch ?? `pr-${prNumber}`;
    const branchTarget = pull.base?.ref ?? pull.target_branch ?? "main";
    const author = pull.user?.login ?? pull.author?.username ?? "unknown";
    const externalUrl = pull.html_url ?? pull.web_url ?? undefined;
    const dedupeKey = `${provider}:${repository}:${prNumber}`;

    const existing = await prisma.pullRequestCheck.findFirst({
      where: { organisationId: actor.org.id, repository, prNumber },
    });

    const record =
      existing ??
      (await prisma.pullRequestCheck.create({
        data: {
          organisationId: actor.org.id,
          prNumber,
          title: pull.title,
          branch,
          branchTarget,
          author,
          provider,
          repository,
          externalUrl,
          status: "running",
          riskLevel: "low",
          filesChanged: 0,
          changedFilesJson: "[]",
        },
      }));

    const wasNew = !existing;
    if (wasNew || record.status === "running") {
      try {
        await analyzePullRequest(record, actor);
        analysed += 1;
      } catch {
        // Analysis is best-effort; the notification still goes out.
      }
    }
    if (wasNew) {
      const result = await recordEvent(
        actor.org.id,
        {
          provider,
          eventType: "pr.opened_or_updated",
          title: `PR #${prNumber} · ${pull.title}`,
          body: `${author} opened ${branch} → ${branchTarget} on ${repository ?? "repository"}${analysed ? " · AI impact analysis running" : ""}`,
          linkUrl: externalUrl,
          dedupeKey,
        },
        actor,
      );
      if (result === "created") created += 1;
    }
  }

  return {
    provider,
    name: provider === "GITHUB" ? "GitHub" : "GitLab",
    mode,
    note:
      mode === "live"
        ? `${pullRequests.length} pull request(s) reviewed, ${analysed} analysed`
        : repository
          ? "Live fetch unavailable (credentials/network) — simulated sweep"
          : "No repository configured — simulated sweep",
    events: pullRequests.length,
    newEvents: created,
  };
}

// ---------------------------------------------------------------------------
// Jira (issues → Requirements)
// ---------------------------------------------------------------------------

async function syncJira(actor: Actor, integration: IntegrationLike): Promise<ProviderSyncReport> {
  const config = parseIntegrationConfig(integration.configJson);
  const site = configValue(config, "url", "site", "siteUrl", "baseUrl");
  const email = configValue(config, "email", "username", "userEmail");
  const token = configValue(config, "apiToken", "token", "apiKey") ?? process.env.ATLASSIAN_API_TOKEN;
  const project = configValue(config, "projectKey", "project");

  let mode: "live" | "simulated" = "live";
  let issues: Array<{ key: string; summary: string; url?: string }> = [];

  if (site && token) {
    const jql = project ? `project = ${project} ORDER BY updated DESC` : "ORDER BY updated DESC";
    const data = await fetchJson(`${trimTrailingSlash(site)}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=10`, {
      headers: {
        Authorization: email ? `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}` : `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    const apiIssues = (data as { issues?: Array<{ key: string; fields?: { summary?: string } }> } | null)?.issues;
    if (apiIssues) {
      issues = apiIssues.map((issue) => ({
        key: issue.key,
        summary: issue.fields?.summary ?? issue.key,
        url: `${trimTrailingSlash(site)}/browse/${issue.key}`,
      }));
    }
    if (issues.length === 0) mode = "simulated";
  } else {
    mode = "simulated";
  }

  let created = 0;
  for (const issue of issues) {
    await prisma.requirement.upsert({
      where: { organisationId_code: { organisationId: actor.org.id, code: `JIRA-${issue.key}` } },
      create: { organisationId: actor.org.id, code: `JIRA-${issue.key}`, title: issue.summary, source: "import", coverageStatus: "uncovered" },
      update: { title: issue.summary },
    });
    const result = await recordEvent(
      actor.org.id,
      {
        provider: "JIRA",
        eventType: "jira.issue_synced",
        title: `${issue.key} · ${issue.summary}`,
        body: `Jira issue synced into Requirements`,
        linkUrl: issue.url,
        dedupeKey: `JIRA:${issue.key}`,
      },
      actor,
    );
    if (result === "created") created += 1;
  }

  return {
    provider: "JIRA",
    name: "Jira",
    mode,
    note:
      mode === "live"
        ? `${issues.length} issue(s) synced into Requirements`
        : site
          ? "Live fetch unavailable — simulated sweep"
          : "No site configured — simulated sweep",
    events: issues.length,
    newEvents: created,
  };
}

// ---------------------------------------------------------------------------
// Confluence (page updates → Knowledge Base)
// ---------------------------------------------------------------------------

async function syncConfluence(actor: Actor, integration: IntegrationLike): Promise<ProviderSyncReport> {
  const config = parseIntegrationConfig(integration.configJson);
  const site = configValue(config, "url", "site", "siteUrl", "baseUrl");
  const email = configValue(config, "email", "username", "userEmail");
  const token = configValue(config, "apiToken", "token", "apiKey") ?? process.env.ATLASSIAN_API_TOKEN;

  let mode: "live" | "simulated" = "live";
  let pages: Array<{ id: string; title: string; url?: string }> = [];

  if (site && token) {
    const data = await fetchJson(
      `${trimTrailingSlash(site)}/rest/api/content?type=page&limit=10&expand=metadata.labels`,
      {
        headers: {
          Authorization: email ? `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}` : `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    const apiPages = (data as { results?: Array<{ id: string; title: string; _links?: { webui?: string } }> } | null)?.results;
    if (apiPages) {
      pages = apiPages.map((page) => ({
        id: page.id,
        title: page.title,
        url: page._links?.webui ? `${trimTrailingSlash(site)}${page._links.webui}` : undefined,
      }));
    }
    if (pages.length === 0) mode = "simulated";
  } else {
    mode = "simulated";
  }

  let created = 0;
  for (const page of pages) {
    const urlOrPath = page.url ?? `confluence:${page.id}`;
    const existing = await prisma.knowledgeItem.findFirst({
      where: { organisationId: actor.org.id, urlOrPath },
      select: { id: true },
    });
    if (existing) {
      await prisma.knowledgeItem.update({ where: { id: existing.id }, data: { title: page.title, status: "indexed" } });
    } else {
      await prisma.knowledgeItem.create({
        data: {
          organisationId: actor.org.id,
          title: page.title,
          type: "doc",
          urlOrPath,
          status: "indexed",
        },
      });
    }
    const result = await recordEvent(
      actor.org.id,
      {
        provider: "CONFLUENCE",
        eventType: "docs.confluence_updated",
        title: `Confluence · ${page.title}`,
        body: "Page update mirrored into the Knowledge Base",
        linkUrl: page.url,
        dedupeKey: `CONFLUENCE:${page.id}`,
      },
      actor,
    );
    if (result === "created") created += 1;
  }

  return {
    provider: "CONFLUENCE",
    name: "Confluence",
    mode,
    note:
      mode === "live"
        ? `${pages.length} page(s) mirrored into the Knowledge Base`
        : site
          ? "Live fetch unavailable — simulated sweep"
          : "No site configured — simulated sweep",
    events: pages.length,
    newEvents: created,
  };
}

// ---------------------------------------------------------------------------
// Generic / simulated providers
// ---------------------------------------------------------------------------

async function syncSimulated(
  actor: Actor,
  integration: IntegrationLike,
  name: string,
): Promise<ProviderSyncReport> {
  const dedupeKey = `HEARTBEAT:${integration.provider}:${new Date().toISOString().slice(0, 13)}`;
  const result = await recordEvent(
    actor.org.id,
    {
      provider: integration.provider,
      eventType: integration.provider === "SLACK" || integration.provider === "TEAMS" ? "test_run.failed_or_regression" : "autopilot.completed",
      title: `${name} heartbeat`,
      body: `${name} stayed in sync during this pass (simulated activity).`,
      dedupeKey,
    },
    actor,
  );
  return {
    provider: integration.provider,
    name,
    mode: "simulated",
    note: "Metadata refreshed (simulated activity)",
    events: 1,
    newEvents: result === "created" ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const PROVIDER_NAMES: Record<string, string> = {
  GITHUB: "GitHub",
  GITLAB: "GitLab",
  JIRA: "Jira",
  CONFLUENCE: "Confluence",
  SLACK: "Slack",
  TEAMS: "Microsoft Teams",
  AZURE_DEVOPS: "Azure DevOps",
};

/**
 * Runs one sync pass over every CONNECTED integration of the organisation.
 * Never throws: a failing provider is reported with `mode: "simulated"`.
 */
export async function runSyncPass(actor: Actor, options: { provider?: string } = {}): Promise<SyncPassResult> {
  const startedAt = Date.now();
  const org = await prisma.organisation.findUniqueOrThrow({ where: { id: actor.org.id } });
  const integrations = await prisma.integration.findMany({
    where: { organisationId: actor.org.id, status: "CONNECTED", ...(options.provider ? { provider: options.provider } : {}) },
    orderBy: { updatedAt: "desc" },
  });

  const reports: ProviderSyncReport[] = [];
  for (const integration of integrations) {
    const name = PROVIDER_NAMES[integration.provider] ?? integration.provider;
    try {
      if (integration.provider === "GITHUB" || integration.provider === "GITLAB") {
        reports.push(await syncGitProvider(actor, integration, integration.provider));
      } else if (integration.provider === "JIRA") {
        reports.push(await syncJira(actor, integration));
      } else if (integration.provider === "CONFLUENCE") {
        reports.push(await syncConfluence(actor, integration));
      } else {
        reports.push(await syncSimulated(actor, integration, name));
      }
    } catch (error) {
      reports.push({
        provider: integration.provider,
        name,
        mode: "simulated",
        note: `Pass skipped (${error instanceof Error ? error.message : "unknown error"})`,
        events: 0,
        newEvents: 0,
      });
    }
  }

  return {
    organisationId: actor.org.id,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    intervalSeconds: planEntitlements(org.plan).syncIntervalSeconds,
    reports,
    newNotifications: reports.reduce((sum, report) => sum + report.newEvents, 0),
  };
}
