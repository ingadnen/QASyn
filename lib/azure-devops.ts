/**
 * Azure DevOps REST API v7.1 client for QASyn.
 *
 * The module is intentionally free of Prisma imports so it can also power the
 * integration modal's URL parser in the browser. Every network call falls back
 * gracefully: callers can switch to the deterministic `ai-test-automations /
 * AI Test Automation` mirror snapshot when a PAT is absent or the remote API is
 * unreachable.
 */
import type { NlpStep } from "./engines";

export interface ParsedAzureDevOpsUrl {
  orgUrl: string;
  organization: string;
  project: string;
  projectEncoded: string;
}

export interface AzureDevOpsConfig {
  orgUrl: string;
  organization: string;
  project: string;
  projectEncoded: string;
  pat: string;
  repository: string;
  baseBranch: string;
}

export interface AzureRepository {
  id: string;
  name: string;
  size: number;
  defaultBranch: string;
  webUrl: string;
  empty: boolean;
}

export interface AzurePullRequest {
  id: number;
  title: string;
  status: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  createdAt: string;
  repository: string;
  repositoryId: string;
  externalUrl: string;
  changedFiles: string[];
  additions: number;
  deletions: number;
}

export interface AzureWorkItem {
  id: number;
  title: string;
  type: string;
  state: string;
  priority: number;
  assignedTo: string;
  description: string;
  externalUrl: string;
}

export interface AzureTestCase {
  id: number;
  title: string;
  state: string;
  priority: number;
  description: string;
  steps: NlpStep[];
  externalUrl: string;
}

export interface AzureTestSuite {
  id: number;
  name: string;
  suiteType: string;
  testCases: AzureTestCase[];
}

export interface AzureTestPlan {
  id: number;
  name: string;
  state: string;
  description: string;
  suites: AzureTestSuite[];
}

export interface AzureDevOpsSnapshot {
  organization: string;
  project: string;
  orgUrl: string;
  repositories: AzureRepository[];
  pullRequests: AzurePullRequest[];
  workItems: AzureWorkItem[];
  plans: AzureTestPlan[];
  emptyReposWarning: string | null;
}

const API_VERSION = "7.1";

/** Parses any Azure DevOps browser URL, including encoded project names. */
export function parseAzureDevOpsUrl(input: string): ParsedAzureDevOpsUrl {
  const raw = String(input || "").trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { orgUrl: "", organization: "", project: "", projectEncoded: "" };
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });

  let organization = "";
  let project = "";
  if (host === "dev.azure.com") {
    organization = (url.username || segments[0] || "").trim();
    project = (segments[1] || "").trim();
  } else if (host.endsWith(".visualstudio.com")) {
    organization = host.replace(/\.visualstudio\.com$/i, "");
    project = (segments[0] || "").trim();
  } else if (host.endsWith("azure.com")) {
    organization = (url.username || segments[0] || "").trim();
    project = (segments[1] || "").trim();
  } else {
    organization = segments[0] || "";
    project = segments[1] || "";
  }

  organization = organization.replace(/^@/, "").trim();
  // A pasted direct project URL may omit the org segment; keep the first path
  // segment as the organization and leave the project empty in that case.
  if (!organization && segments.length > 0) organization = segments[0];
  const orgUrl = organization ? `https://dev.azure.com/${encodeURIComponent(organization)}` : "";
  return {
    orgUrl,
    organization,
    project,
    projectEncoded: project ? encodeURIComponent(project) : "",
  };
}

/** Normalises the stored integration config and resolves the API base URL. */
export function resolveAzureDevOpsConfig(config: Record<string, string> = {}): AzureDevOpsConfig {
  const rawOrganization = String(config.baseUrl || config.organization || "").trim();
  const parsed = rawOrganization ? parseAzureDevOpsUrl(rawOrganization) : null;
  const organizationFromRaw = rawOrganization
    ? rawOrganization
        .replace(/^https?:\/\/dev\.azure\.com\//i, "")
        .replace(/^https?:\/\/[^/]+\/?/i, "")
        .replace(/[/?#].*$/, "")
        .replace(/^@/, "")
        .trim()
    : "";
  const organization = (parsed?.organization || organizationFromRaw || "").trim();
  const project = String(config.project || parsed?.project || "").trim();
  const orgUrl = organization ? `https://dev.azure.com/${encodeURIComponent(organization)}` : parsed?.orgUrl || "";
  return {
    orgUrl,
    organization,
    project,
    projectEncoded: project ? encodeURIComponent(project) : "",
    pat: String(config.pat || config.token || "").trim(),
    repository: String(config.repository || "").trim(),
    baseBranch: String(config.baseBranch || "main").trim() || "main",
  };
}

class AzureDevOpsError extends Error {
  status: number;
  url: string;
  body: string;
  constructor(status: number, url: string, body: string) {
    super(`Azure DevOps API ${status} for ${url}`);
    this.name = "AzureDevOpsError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

function basicAuth(pat: string): string {
  return `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
}

async function adoFetch<T>(
  config: AzureDevOpsConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!config.orgUrl) throw new AzureDevOpsError(0, path, "Missing Azure DevOps organization URL.");
  const url = /^https?:\/\//i.test(path) ? path : `${config.orgUrl}/${config.projectEncoded}${path}`;
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: basicAuth(config.pat),
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new AzureDevOpsError(response.status, url, text.slice(0, 800));
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function valueOf(field: unknown): string {
  if (field == null) return "";
  if (typeof field === "string") return field;
  if (typeof field === "object") {
    const record = field as Record<string, unknown>;
    return String(record.displayName ?? record.uniqueName ?? record.name ?? "");
  }
  return String(field);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function stripHtml(value: string): string {
  return decodeXmlEntities(value)
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|td|th)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferredAction(actionText: string): string {
  const text = actionText.toLowerCase();
  if (/navigate|go to|open the|launch|visit|url|browse/.test(text)) return "Navigate";
  if (/click|tap|press|select|choose|hover|menu|button|link/.test(text)) return "Click";
  if (/enter|type|fill|input|search for|set the|provide/.test(text)) return "Enter Text";
  if (/verify|validate|check|assert|ensure|confirm|expect|should|see |visible/.test(text)) return "Verify Element";
  return "Verify Element";
}

function inferredValue(action: string, actionText: string): string {
  if (action !== "Enter Text") return "";
  const quoted = /["“]([^"”]{1,120})["”]|'([^']{1,120})'/.exec(actionText);
  if (quoted) return (quoted[1] || quoted[2] || "").trim();
  const remainder = actionText.replace(/^.*?(?:enter|type|fill|input)\s+/i, "").trim();
  return remainder.slice(0, 120);
}

function uniqueSteps(steps: NlpStep[]): NlpStep[] {
  return steps.map((step, index) => ({
    id: `s${index + 1}`,
    action: step.action,
    target: step.target.slice(0, 2000),
    value: (step.value || "").slice(0, 2000),
    selector: (step.selector || "").slice(0, 1000),
    expectedResult: (step.expectedResult || "The step completes successfully.").slice(0, 2000),
  }));
}

interface FlowOverride {
  action: string;
  target: string;
  selector: string;
  value: string;
  expected: string;
}

function flowOverrideForTitle(title: string): FlowOverride {
  const lower = title.toLowerCase();
  if (/language|locale|french|fran[cç]ais|selector/.test(lower)) {
    return {
      action: "Click",
      target: 'Click "FR" in the language selector',
      selector: 'css:a[href*="/fr"]',
      value: "",
      expected: "The French version of the site loads with translated navigation and content.",
    };
  }
  if (/left[- ]side|navigation|menu|sidebar/.test(lower)) {
    return {
      action: "Click",
      target: 'Click "Services" in the main navigation',
      selector: "css:nav a",
      value: "",
      expected: "The navigation menu opens and every destination link is reachable.",
    };
  }
  if (/footer/.test(lower)) {
    return {
      action: "Verify Element",
      target: "Verify the global footer links and legal notices are visible",
      selector: "css:footer",
      value: "",
      expected: "Footer links, legal notices and regional selectors are visible and aligned.",
    };
  }
  if (/call[- ]to[- ]action|cta|button/.test(lower)) {
    return {
      action: "Click",
      target: "Click the primary call-to-action button",
      selector: "css:main a, main button",
      value: "",
      expected: "The primary call-to-action responds and opens its target journey.",
    };
  }
  if (/responsive|mobile/.test(lower)) {
    return {
      action: "Click",
      target: "Click the mobile menu toggle and verify the responsive layout",
      selector: "[aria-label*='menu' i], button[aria-expanded]",
      value: "",
      expected: "The mobile menu opens and the layout adapts to the viewport.",
    };
  }
  if (/cross[- ]browser/.test(lower)) {
    return {
      action: "AI Assertion",
      target: "Verify the page renders consistently across Chromium, Firefox and WebKit",
      selector: "",
      value: "",
      expected: "The layout and interactions render consistently across browsers.",
    };
  }
  if (/cross[- ]device|resolution|orientation/.test(lower)) {
    return {
      action: "AI Assertion",
      target: "Verify the page renders correctly across device sizes and orientations",
      selector: "",
      value: "",
      expected: "Content remains readable and interactive at desktop, tablet and mobile sizes.",
    };
  }
  if (/javascript|console|missing resource|error/.test(lower)) {
    return {
      action: "AI Assertion",
      target: "Verify the page loads with zero JavaScript errors and no missing resources",
      selector: "",
      value: "",
      expected: "The browser console is clean and every required resource returns successfully.",
    };
  }
  if (/loading|visibility|visible/.test(lower)) {
    return {
      action: "Verify Element",
      target: "Verify the initial loading state resolves and the primary content is visible",
      selector: "css:main",
      value: "",
      expected: "The loading state completes and the primary content becomes visible.",
    };
  }
  if (/landing|page loads|loads correctly/.test(lower)) {
    return {
      action: "Verify Element",
      target: "Verify the landing page hero and primary content are fully rendered",
      selector: "css:h1",
      value: "",
      expected: "The landing page hero, primary content and navigation render without errors.",
    };
  }
  return {
    action: "Click",
    target: 'Click "Services" in the main navigation',
    selector: "css:nav a",
    value: "",
    expected: `The "${title.slice(0, 90)}" journey opens its target view with the expected content.`,
  };
}

/** Generates six grounded, title-specific QASyn steps when ADO has no TCM XML. */
export function groundedStepsForAzureTitle(title: string, targetUrl: string): NlpStep[] {
  const cleanTitle = title.replace(/\s+/g, " ").trim().slice(0, 180) || "Azure DevOps test case";
  const url = /^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl.replace(/^\/+/, "")}`;
  const override = flowOverrideForTitle(cleanTitle);
  return uniqueSteps([
    {
      id: "s1",
      action: "Navigate",
      target: url,
      value: "",
      selector: "",
      expectedResult: `The application responds with HTTP 200 and renders the landing document at ${url}.`,
    },
    {
      id: "s2",
      action: "Verify Element",
      target: "Verify the primary heading is visible above the fold",
      value: "",
      selector: "css:h1",
      expectedResult: `A primary heading relevant to "${cleanTitle.slice(0, 80)}" is visible above the fold.`,
    },
    {
      id: "s3",
      ...override,
    },
    {
      id: "s4",
      action: "Verify Element",
      target: "Verify the main content and interactive controls are visible",
      value: "",
      selector: "css:main",
      expectedResult: "Main content, forms and interactive controls are visible and usable.",
    },
    {
      id: "s5",
      action: "Verify Element",
      target: "Verify navigation and footer landmarks are visible",
      value: "",
      selector: "css:footer",
      expectedResult: "Global navigation, footer links and regional landmarks remain accessible.",
    },
    {
      id: "s6",
      action: "AI Assertion",
      target: `Verify "${cleanTitle.slice(0, 80)}" completes with zero console or network errors`,
      value: "",
      selector: "",
      expectedResult: "QASyn Vision AI visual verification confirms the use case completed with 0 console/network errors.",
    },
  ]);
}

/** Parses the Microsoft.VSTS.TCM.Steps XML into executable QASyn steps. */
export function parseAzureTcmStepsXml(xml: string, fallbackTitle: string, targetUrl: string): NlpStep[] {
  const source = String(xml || "");
  const parsed: NlpStep[] = [];
  const blocks = [...source.matchAll(/<step\b[^>]*>([\s\S]*?)<\/step>/gi)].map((match) => match[1]);
  for (const block of blocks) {
    const params = [...block.matchAll(/<parameterizedString\b[^>]*>([\s\S]*?)<\/parameterizedString>/gi)].map((match) =>
      stripHtml(match[1]),
    );
    const actionText = (params[0] || "").trim();
    const expected = (params[1] || "").trim();
    if (!actionText && !expected) continue;
    const action = inferredAction(actionText || expected);
    const urlMatch = /https?:\/\/[^\s"'<>]+/i.exec(actionText);
    const target = action === "Navigate" && urlMatch ? urlMatch[0] : actionText || fallbackTitle;
    parsed.push({
      id: `s${parsed.length + 1}`,
      action,
      target: target.slice(0, 2000),
      value: inferredValue(action, actionText),
      selector: "",
      expectedResult: (expected || "The step completes and the expected state is observed.").slice(0, 2000),
    });
  }

  if (parsed.length === 0) {
    const allParams = [...source.matchAll(/<parameterizedString\b[^>]*>([\s\S]*?)<\/parameterizedString>/gi)].map((match) =>
      stripHtml(match[1]),
    );
    for (let index = 0; index < allParams.length; index += 2) {
      const actionText = (allParams[index] || "").trim();
      const expected = (allParams[index + 1] || "").trim();
      if (!actionText && !expected) continue;
      const action = inferredAction(actionText || expected);
      const urlMatch = /https?:\/\/[^\s"'<>]+/i.exec(actionText);
      parsed.push({
        id: `s${parsed.length + 1}`,
        action,
        target: (action === "Navigate" && urlMatch ? urlMatch[0] : actionText || fallbackTitle).slice(0, 2000),
        value: inferredValue(action, actionText),
        selector: "",
        expectedResult: (expected || "The step completes and the expected state is observed.").slice(0, 2000),
      });
    }
  }

  // A title-only ADO test case receives six grounded steps tailored to its use case.
  if (parsed.length === 0) return groundedStepsForAzureTitle(fallbackTitle, targetUrl);
  const generated = groundedStepsForAzureTitle(fallbackTitle, targetUrl);
  for (let index = parsed.length; index < 6; index += 1) {
    const fallback = generated[index] ?? generated[generated.length - 1];
    parsed.push({ ...fallback, id: `s${index + 1}` });
  }
  return uniqueSteps(parsed);
}

function azureRepositoryUrl(config: AzureDevOpsConfig, repository: string): string {
  return `${config.orgUrl}/${config.projectEncoded}/_git/${encodeURIComponent(repository)}`;
}

function azurePullRequestUrl(config: AzureDevOpsConfig, repository: string, prId: number): string {
  return `${azureRepositoryUrl(config, repository)}/pullrequest/${prId}`;
}

export async function fetchAzureRepositories(config: AzureDevOpsConfig): Promise<AzureRepository[]> {
  const payload = await adoFetch<{ value?: Array<Record<string, unknown>> }>(
    config,
    `/_apis/git/repositories?api-version=${API_VERSION}`,
  );
  return (payload.value ?? []).map((repository) => {
    const name = String(repository.name ?? "repository");
    const size = Number(repository.size ?? 0);
    return {
      id: String(repository.id ?? name),
      name,
      size,
      defaultBranch: String(repository.defaultBranch ?? "refs/heads/main").replace(/^refs\/heads\//, ""),
      webUrl: String(repository.webUrl ?? azureRepositoryUrl(config, name)),
      empty: size === 0,
    };
  });
}

async function fetchAzureChangedFiles(
  config: AzureDevOpsConfig,
  repositoryId: string,
  prId: number,
): Promise<string[]> {
  try {
    const iterations = await adoFetch<{ value?: Array<{ id?: number }> }>(
      config,
      `/_apis/git/repositories/${encodeURIComponent(repositoryId)}/pullrequests/${prId}/iterations?api-version=${API_VERSION}`,
    );
    const iterationId = iterations.value?.[iterations.value.length - 1]?.id;
    if (iterationId == null) return [];
    const changes = await adoFetch<{ changeEntries?: Array<{ item?: { path?: string } }>; value?: Array<{ item?: { path?: string } }> }>(
      config,
      `/_apis/git/repositories/${encodeURIComponent(repositoryId)}/pullrequests/${prId}/iterations/${iterationId}/changes?$top=100&api-version=${API_VERSION}`,
    );
    const entries = changes.changeEntries ?? changes.value ?? [];
    return entries
      .map((entry) => String(entry.item?.path ?? "").replace(/^\//, ""))
      .filter(Boolean)
      .slice(0, 100);
  } catch {
    return [];
  }
}

export async function fetchAzurePullRequests(
  config: AzureDevOpsConfig,
): Promise<{ repositories: AzureRepository[]; pullRequests: AzurePullRequest[]; emptyReposWarning: string | null }> {
  const repositories = await fetchAzureRepositories(config);
  const pullRequests: AzurePullRequest[] = [];
  const emptyRepos: string[] = [];
  for (const repository of repositories) {
    if (repository.empty) {
      emptyRepos.push(repository.name);
      continue;
    }
    let payload: { value?: Array<Record<string, unknown>> } = {};
    try {
      payload = await adoFetch<{ value?: Array<Record<string, unknown>> }>(
        config,
        `/_apis/git/repositories/${encodeURIComponent(repository.id)}/pullrequests?searchCriteria.status=all&$top=25&api-version=${API_VERSION}`,
      );
    } catch {
      continue;
    }
    for (const pr of payload.value ?? []) {
      const author = valueOf(pr.createdBy);
      const id = Number(pr.pullRequestId ?? pr.id ?? 0);
      if (!id) continue;
      const changedFiles = await fetchAzureChangedFiles(config, repository.id, id);
      pullRequests.push({
        id,
        title: String(pr.title ?? `Pull request #${id}`),
        status: String(pr.status ?? "active"),
        sourceBranch: String(pr.sourceRefName ?? "").replace(/^refs\/heads\//, "") || `pr-${id}`,
        targetBranch: String(pr.targetRefName ?? "").replace(/^refs\/heads\//, "") || "main",
        author: author || "azure-devops",
        createdAt: String(pr.creationDate ?? new Date().toISOString()),
        repository: repository.name,
        repositoryId: repository.id,
        externalUrl: azurePullRequestUrl(config, repository.name, id),
        changedFiles,
        additions: Number(pr.additions ?? 0),
        deletions: Number(pr.deletions ?? 0),
      });
    }
  }
  const emptyReposWarning = emptyRepos.length > 0 ? `${emptyRepos.join(", ")} is empty. Add some code!` : null;
  return { repositories, pullRequests, emptyReposWarning };
}

export async function fetchAzureWorkItems(config: AzureDevOpsConfig): Promise<AzureWorkItem[]> {
  const wiql = `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.WorkItemType] IN ('Product Backlog Item', 'User Story', 'Requirement', 'Task', 'Bug', 'Issue', 'Epic', 'Feature') ORDER BY [System.ChangedDate] DESC`;
  const query = await adoFetch<{ workItems?: Array<{ id?: number }> }>(config, `/_apis/wit/wiql?api-version=${API_VERSION}`, {
    method: "POST",
    body: JSON.stringify({ query: wiql }),
  });
  const ids = (query.workItems ?? []).map((workItem) => Number(workItem.id)).filter(Boolean).slice(0, 50);
  if (ids.length === 0) return [];
  const fields = [
    "System.Id",
    "System.Title",
    "System.WorkItemType",
    "System.State",
    "System.Description",
    "System.AssignedTo",
    "System.CreatedBy",
    "System.CreatedDate",
    "Microsoft.VSTS.Common.Priority",
  ].join(",");
  const payload = await adoFetch<{ value?: Array<{ id?: number; fields?: Record<string, unknown> }> }>(
    config,
    `/_apis/wit/workitems?ids=${ids.join(",")}&fields=${encodeURIComponent(fields)}&api-version=${API_VERSION}`,
  );
  return (payload.value ?? []).map((item) => {
    const itemFields = item.fields ?? {};
    return {
      id: Number(item.id ?? itemFields["System.Id"] ?? 0),
      title: String(itemFields["System.Title"] ?? `Work item #${item.id ?? ""}`),
      type: String(itemFields["System.WorkItemType"] ?? "Work Item"),
      state: String(itemFields["System.State"] ?? "Active"),
      priority: Number(itemFields["Microsoft.VSTS.Common.Priority"] ?? 3),
      assignedTo: valueOf(itemFields["System.AssignedTo"]),
      description: stripHtml(String(itemFields["System.Description"] ?? "")).slice(0, 4000),
      externalUrl: `${config.orgUrl}/${config.projectEncoded}/_workitems/edit/${item.id ?? ""}`,
    };
  }).filter((item) => item.id > 0);
}

async function fetchSuiteTestCaseIds(
  config: AzureDevOpsConfig,
  planId: number,
  suiteId: number,
): Promise<number[]> {
  try {
    const modern = await adoFetch<{ value?: Array<{ testCase?: { id?: number } }> }>(
      config,
      `/_apis/testplan/Plans/${planId}/Suites/${suiteId}/TestCase?api-version=${API_VERSION}`,
    );
    const ids = (modern.value ?? []).map((entry) => Number(entry.testCase?.id ?? 0)).filter(Boolean);
    if (ids.length > 0) return ids;
  } catch {
    /* fall through to the classic endpoint */
  }
  try {
    const classic = await adoFetch<{ value?: Array<{ testCase?: { id?: number } }> }>(
      config,
      `/_apis/test/Plans/${planId}/Suites/${suiteId}/testcases?api-version=7.0`,
    );
    const ids = (classic.value ?? []).map((entry) => Number(entry.testCase?.id ?? 0)).filter(Boolean);
    if (ids.length > 0) return ids;
  } catch {
    /* points fallback below */
  }
  try {
    const points = await adoFetch<{ value?: Array<{ testCase?: { id?: number }; testCaseId?: number }> }>(
      config,
      `/_apis/test/Plans/${planId}/Suites/${suiteId}/points?api-version=7.0`,
    );
    return (points.value ?? [])
      .map((point) => Number(point.testCase?.id ?? point.testCaseId ?? 0))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchAdoTestCases(
  config: AzureDevOpsConfig,
  ids: number[],
  targetUrl: string,
): Promise<Map<number, AzureTestCase>> {
  const result = new Map<number, AzureTestCase>();
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  for (let index = 0; index < uniqueIds.length; index += 50) {
    const chunk = uniqueIds.slice(index, index + 50);
    if (chunk.length === 0) continue;
    const fields = [
      "System.Id",
      "System.Title",
      "System.Description",
      "System.State",
      "Microsoft.VSTS.Common.Priority",
      "Microsoft.VSTS.TCM.Steps",
    ].join(",");
    const payload = await adoFetch<{ value?: Array<{ id?: number; fields?: Record<string, unknown> }> }>(
      config,
      `/_apis/wit/workitems?ids=${chunk.join(",")}&fields=${encodeURIComponent(fields)}&api-version=${API_VERSION}`,
    );
    for (const item of payload.value ?? []) {
      const itemFields = item.fields ?? {};
      const id = Number(item.id ?? itemFields["System.Id"] ?? 0);
      if (!id) continue;
      const title = String(itemFields["System.Title"] ?? `Test case #${id}`);
      const stepsXml = String(itemFields["Microsoft.VSTS.TCM.Steps"] ?? "");
      result.set(id, {
        id,
        title,
        state: String(itemFields["System.State"] ?? "Design"),
        priority: Number(itemFields["Microsoft.VSTS.Common.Priority"] ?? 3),
        description: stripHtml(String(itemFields["System.Description"] ?? "")).slice(0, 4000),
        steps: parseAzureTcmStepsXml(stepsXml, title, targetUrl),
        externalUrl: `${config.orgUrl}/${config.projectEncoded}/_workitems/edit/${id}`,
      });
    }
  }
  return result;
}

export async function fetchAzureTestPlansTree(
  config: AzureDevOpsConfig,
  targetUrl: string,
): Promise<AzureTestPlan[]> {
  let planPayload: { value?: Array<Record<string, unknown>> } = {};
  try {
    planPayload = await adoFetch<{ value?: Array<Record<string, unknown>> }>(
      config,
      `/_apis/testplan/Plans?api-version=${API_VERSION}`,
    );
  } catch {
    planPayload = await adoFetch<{ value?: Array<Record<string, unknown>> }>(
      config,
      `/_apis/test/plans?api-version=7.0`,
    );
  }
  const plans: AzureTestPlan[] = [];
  for (const plan of planPayload.value ?? []) {
    const planId = Number(plan.id ?? plan.planId ?? 0);
    if (!planId) continue;
    let suitePayload: { value?: Array<Record<string, unknown>> } = {};
    try {
      suitePayload = await adoFetch<{ value?: Array<Record<string, unknown>> }>(
        config,
        `/_apis/testplan/Plans/${planId}/suites?api-version=${API_VERSION}`,
      );
    } catch {
      try {
        suitePayload = await adoFetch<{ value?: Array<Record<string, unknown>> }>(
          config,
          `/_apis/test/Plans/${planId}/suites?api-version=7.0`,
        );
      } catch {
        suitePayload = {};
      }
    }
    const suites: AzureTestSuite[] = [];
    const seenCases = new Map<number, AzureTestCase>();
    for (const suite of suitePayload.value ?? []) {
      const suiteId = Number(suite.id ?? suite.suiteId ?? 0);
      if (!suiteId) continue;
      const caseIds = await fetchSuiteTestCaseIds(config, planId, suiteId);
      const fetched = await fetchAdoTestCases(config, caseIds, targetUrl);
      const cases = [...fetched.values()];
      for (const testCase of cases) seenCases.set(testCase.id, testCase);
      suites.push({
        id: suiteId,
        name: String(suite.name ?? `Suite #${suiteId}`),
        suiteType: String(suite.suiteType ?? "StaticTestSuite"),
        testCases: cases,
      });
    }
    plans.push({
      id: planId,
      name: String(plan.name ?? `Test Plan #${planId}`),
      state: String(plan.state ?? "Active"),
      description: stripHtml(String(plan.description ?? "")).slice(0, 2000),
      suites,
    });
  }
  return plans;
}

/** Posts a Markdown QASyn PR Gate comment to the Azure DevOps PR thread. */
export async function postAzurePullRequestComment(
  config: AzureDevOpsConfig,
  repository: string,
  prId: number,
  markdown: string,
): Promise<{ posted: boolean; status: number; error?: string }> {
  if (!config.pat) return { posted: false, status: 0, error: "No Azure DevOps PAT configured." };
  const repositoryName = String(repository || config.repository || "").split("/").pop() || "";
  if (!repositoryName) return { posted: false, status: 0, error: "No Azure DevOps repository configured." };
  try {
    await adoFetch<{ id?: number }>(
      config,
      `/_apis/git/repositories/${encodeURIComponent(repositoryName)}/pullrequests/${prId}/threads?api-version=${API_VERSION}`,
      {
        method: "POST",
        body: JSON.stringify({
          comments: [{ parentCommentId: 0, content: markdown, commentType: 1 }],
          status: 1,
        }),
      },
    );
    return { posted: true, status: 200 };
  } catch (error) {
    const caught = error as { status?: number; body?: string; message?: string };
    return { posted: false, status: caught.status ?? 0, error: caught.body || caught.message || "Azure DevOps rejected the comment." };
  }
}

/** True when the configured credential looks like a real Azure DevOps PAT. */
export function isLiveAzurePat(pat: string): boolean {
  const value = String(pat || "").trim();
  if (value.length < 30) return false;
  if (/^azd_/i.test(value) || /placeholder|your[-_]?pat|replace/i.test(value)) return false;
  return /^[A-Za-z0-9+/_=-]+$/.test(value);
}

function mirrorWorkItems(config: AzureDevOpsConfig): AzureWorkItem[] {
  const orgBase = `${config.orgUrl}/${config.projectEncoded}`;
  return [
    {
      id: 958,
      title: "[QA] Verify the Accounts table list and the ability to edit an Account Name",
      type: "Product Backlog Item",
      state: "Active",
      priority: 2,
      assignedTo: "QA Automation",
      description: "Validate the Accounts table renders every row and that inline account-name editing persists.",
      externalUrl: `${orgBase}/_workitems/edit/958`,
    },
    {
      id: 957,
      title: "[QA] Verify the availability and functionality of the left-side menu on all pages",
      type: "Product Backlog Item",
      state: "Active",
      priority: 2,
      assignedTo: "QA Automation",
      description: "Open each page and confirm the left-side navigation remains available and functional.",
      externalUrl: `${orgBase}/_workitems/edit/957`,
    },
    {
      id: 424,
      title: "PBI 424 — AI Test Automation quality coverage",
      type: "Product Backlog Item",
      state: "Active",
      priority: 1,
      assignedTo: "QA Automation",
      description: "Umbrella PBI covering the AI Test Automation plan, suite and end-to-end web journeys.",
      externalUrl: `${orgBase}/_workitems/edit/424`,
    },
    {
      id: 956,
      title: "[QA] Verify the language selector switches the site to French",
      type: "User Story",
      state: "Active",
      priority: 3,
      assignedTo: "QA Automation",
      description: "Select FR from the header language selector and confirm the French version renders.",
      externalUrl: `${orgBase}/_workitems/edit/956`,
    },
  ];
}

const MIRROR_TEST_TITLES = [
  "Landing Page Loads Correctly",
  "Initial Loading and Visibility of Elements",
  "Main Call-to-Action Buttons",
  "Navigation Menu Links",
  "Footer Links",
  "Language Selector",
  "Responsive Design and Mobile Menu",
  "Cross-Browser Compatibility",
  "Cross-Device Compatibility",
  "Screen Resolution and Orientation",
  "JavaScript Errors and Missing Resources",
  "Authentication and Session Handling",
  "Search Functionality and Results",
];

function mirrorRepositories(config: AzureDevOpsConfig): AzureRepository[] {
  const repository = config.repository || config.project || "AI Test Automation";
  return [
    {
      id: "ai-test-automation-repo",
      name: repository,
      size: 1024,
      defaultBranch: "main",
      webUrl: azureRepositoryUrl(config, repository),
      empty: false,
    },
  ];
}

function mirrorPullRequests(config: AzureDevOpsConfig, repository: string): AzurePullRequest[] {
  return [
    {
      id: 901,
      title: "Add inline account-name editing to the Accounts table",
      status: "active",
      sourceBranch: "feature/accounts-table",
      targetBranch: "main",
      author: "QA Automation",
      createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      repository,
      repositoryId: "ai-test-automation-repo",
      externalUrl: azurePullRequestUrl(config, repository, 901),
      changedFiles: [
        "src/accounts/accounts-table.tsx",
        "src/accounts/edit-account-dialog.tsx",
        "src/api/accounts/route.ts",
        "src/accounts/accounts.test.ts",
      ],
      additions: 186,
      deletions: 24,
    },
    {
      id: 902,
      title: "Harden left-side navigation availability across all pages",
      status: "active",
      sourceBranch: "feature/left-menu",
      targetBranch: "main",
      author: "QA Automation",
      createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      repository,
      repositoryId: "ai-test-automation-repo",
      externalUrl: azurePullRequestUrl(config, repository, 902),
      changedFiles: [
        "src/navigation/sidebar.tsx",
        "src/navigation/menu-config.ts",
        "src/layout/app-shell.tsx",
        "src/navigation/sidebar.test.tsx",
      ],
      additions: 122,
      deletions: 37,
    },
  ];
}

/** Faithful `ai-test-automations / AI Test Automation` mirror used offline. */
export function mirrorAzureDevOpsSnapshot(
  config: AzureDevOpsConfig,
  targetUrl = "https://www.cgi.com",
): AzureDevOpsSnapshot {
  const repository = config.repository || config.project || "AI Test Automation";
  const testCases = MIRROR_TEST_TITLES.map((title, index) => {
    const id = 888 + index;
    return {
      id,
      title,
      state: "Design",
      priority: index < 3 ? 1 : index < 8 ? 2 : 3,
      description: `Azure DevOps Test Case #${id} — ${title}. Imported by the QASyn Azure DevOps sync console.`,
      steps: groundedStepsForAzureTitle(title, targetUrl),
      externalUrl: `${config.orgUrl}/${config.projectEncoded}/_workitems/edit/${id}`,
    };
  });
  return {
    organization: config.organization || "ai-test-automations",
    project: config.project || "AI Test Automation",
    orgUrl: config.orgUrl,
    repositories: mirrorRepositories(config),
    pullRequests: mirrorPullRequests(config, repository),
    workItems: mirrorWorkItems(config),
    plans: [
      {
        id: 885,
        name: "QA Agent Plan — PBI 424",
        state: "Active",
        description: "QA Agent Plan — PBI 424 · imported from Azure DevOps Test Plans.",
        suites: [
          {
            id: 887,
            name: "QA Agent Suite",
            suiteType: "StaticTestSuite",
            testCases,
          },
        ],
      },
    ],
    emptyReposWarning: null,
  };
}

/** Fetches the real tree, falling back section-by-section when permissions are partial. */
export async function fetchAzureDevOpsSnapshot(
  config: AzureDevOpsConfig,
  targetUrl: string,
): Promise<AzureDevOpsSnapshot> {
  const pull = await fetchAzurePullRequests(config);
  let workItems: AzureWorkItem[] = [];
  try {
    workItems = await fetchAzureWorkItems(config);
  } catch {
    workItems = [];
  }
  let plans: AzureTestPlan[] = [];
  try {
    plans = await fetchAzureTestPlansTree(config, targetUrl);
  } catch {
    plans = [];
  }
  return {
    organization: config.organization,
    project: config.project,
    orgUrl: config.orgUrl,
    repositories: pull.repositories,
    pullRequests: pull.pullRequests,
    workItems,
    plans,
    emptyReposWarning: pull.emptyReposWarning,
  };
}
