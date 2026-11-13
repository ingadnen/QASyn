/**
 * Provider catalogue for the Integrations module.
 *
 * This file is intentionally free of server imports: the same definitions are
 * used by the configuration modal and by the route handler that validates and
 * persists provider configuration.
 */
export type IntegrationCategory = "All Plugins" | "Bug Reporting" | "Product Management" | "AI & Verification";

export type IntegrationFieldType = "text" | "url" | "password" | "textarea" | "number" | "select";

export interface IntegrationField {
  key: string;
  label: string;
  type: IntegrationFieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface IntegrationDefinition {
  key: string;
  name: string;
  mark: string;
  color: string;
  fg?: string;
  description: string;
  categories: IntegrationCategory[];
  /** Source-control providers can be selected in the Pull Requests module. */
  sourceControl?: boolean;
  /** Included in the 13 Pro integrations unlocked for Pro/Trial. */
  pro?: boolean;
  fields: IntegrationField[];
}

const field = (
  key: string,
  label: string,
  type: IntegrationFieldType,
  placeholder: string,
  required = true,
  help?: string,
): IntegrationField => ({ key, label, type, placeholder, required, help });

const BASE_BRANCH: IntegrationField = {
  key: "baseBranch",
  label: "Base branch",
  type: "text",
  placeholder: "main",
  required: false,
  defaultValue: "main",
  help: "Used to compare open pull requests and post the quality verdict.",
};

export const INTEGRATION_PROVIDERS: IntegrationDefinition[] = [
  {
    key: "AZURE_DEVOPS",
    name: "Azure DevOps Boards",
    mark: "Az",
    color: "#0078d4",
    description:
      "Create and sync Work Items and Bugs, pick Organization / Project / Area Path, and rerun affected tests when a bug closes — without leaving QASyn.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    sourceControl: true,
    pro: true,
    fields: [
      field(
        "organization",
        "Organization URL",
        "text",
        "https://dev.azure.com/ai-test-automations",
        true,
        "Paste any Azure DevOps URL; QASyn splits the organization and project automatically.",
      ),
      field("project", "Project", "text", "AI Test Automation"),
      field("repository", "Repository (for PRs)", "text", "AI Test Automation", false, "Optional: enables Open Pull Request selection."),
      field("areaPath", "Area Path", "text", "AI Test Automation\\QA", false),
      field("pat", "Personal Access Token", "password", "azd_..."),
      BASE_BRANCH,
    ],
  },
  {
    key: "AZURE_VAULT",
    name: "Azure Key Vault",
    mark: "AV",
    color: "#0ea5e9",
    description:
      "Connect a Vault URI with tenant and client credentials, then sync secrets into Global Data and Environment Variables (masked in the UI).",
    categories: ["All Plugins"],
    pro: true,
    fields: [
      field("vaultUri", "Vault URI", "url", "https://cgi-secrets.vault.azure.net/"),
      field("tenantId", "Tenant ID", "text", "72f988bf-86f1-41af-91ab-2d7cd011db47"),
      field("clientId", "Client ID", "text", "b3a91f6c-5b2a-4c8e-9f41-6a7d2c1e8f90"),
      field("clientSecret", "Client Secret", "password", "vault-client-secret"),
      field("secretNames", "Secrets to sync", "textarea", "API_KEY=value\nDB_PASSWORD=value", false, "One NAME=value pair per line. Synced as masked Secret globals."),
    ],
  },
  {
    key: "FIGMA",
    name: "Figma",
    mark: "F",
    color: "#a259ff",
    description:
      "Connect a Personal Access Token and File URL/Key. Extract components and frames to create Requirements or compare screens in Visual Testing.",
    categories: ["All Plugins", "Product Management"],
    pro: true,
    fields: [
      field("accessToken", "Personal Access Token", "password", "figd_••••••••"),
      field("fileUrl", "File URL", "url", "https://www.figma.com/file/AbC123/Digital-Portal"),
      field("fileKey", "File Key", "text", "AbC123", false),
    ],
  },
  {
    key: "YOUTRACK",
    name: "YouTrack",
    mark: "Y",
    color: "#5350f6",
    description: "Instance URL + Permanent Token + Project ID. Two-way sync of bugs and requirements.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    pro: true,
    fields: [
      field("instanceUrl", "Instance URL", "url", "https://cgi.youtrack.cloud"),
      field("permanentToken", "Permanent Token", "password", "perm:••••••••"),
      field("projectId", "Project ID", "text", "DP"),
    ],
  },
  {
    key: "CODESHIP",
    name: "CodeShip CI",
    mark: "CS",
    color: "#1f2937",
    description:
      "API Key + Organization/Project UUID. Trigger Test Plans from a CI build and receive webhook status back in Runs.",
    categories: ["All Plugins"],
    pro: true,
    fields: [
      field("apiKey", "API Key", "password", "codeship-api-key"),
      field("organizationUuid", "Organization UUID", "text", "1f0b8f0a-3c2a-4d7e-8f71-2e6b4a9c0d11"),
      field("projectUuid", "Project UUID", "text", "8f3e6b2a-91c4-4d5a-9c7e-51b2f6a0e3d4"),
    ],
  },
  {
    key: "JENKINS",
    name: "Jenkins",
    mark: "Jk",
    color: "#d33833",
    description:
      "Jenkins URL + Username + API Token + Job Name. Trigger pipelines and surface builds in Pull Requests and Runs.",
    categories: ["All Plugins"],
    pro: true,
    fields: [
      field("url", "Jenkins URL", "url", "https://jenkins.cgi.com"),
      field("username", "Username", "text", "qa-bot"),
      field("apiToken", "API Token", "password", "jenkins-api-token"),
      field("jobName", "Job Name", "text", "digital-portal-regression"),
    ],
  },
  {
    key: "BUGZILLA",
    name: "BugZilla",
    mark: "Bz",
    color: "#cc0000",
    description:
      "Bugzilla URL + API Key + Product/Component. Automatically file bugs from failed Test Runs.",
    categories: ["All Plugins", "Bug Reporting"],
    pro: true,
    fields: [
      field("url", "Bugzilla URL", "url", "https://bugzilla.cgi.com"),
      field("apiKey", "API Key", "password", "bugzilla-api-key"),
      field("product", "Product", "text", "Digital Portal"),
      field("component", "Component", "text", "Checkout"),
    ],
  },
  {
    key: "TRELLO",
    name: "Trello",
    mark: "T",
    color: "#0079bf",
    description:
      "API Key + Token + Board/List selector. Create a Trello card for every bug or gap discovered by QASyn.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    pro: true,
    fields: [
      field("apiKey", "API Key", "text", "trello-api-key"),
      field("token", "Token", "password", "trello-token"),
      field("boardId", "Board ID", "text", "board_9f2a41"),
      field("listId", "List ID", "text", "list_bugs"),
    ],
  },
  {
    key: "PRIVATE_GRID",
    name: "Private Grid",
    mark: "PG",
    color: "#334155",
    description:
      "Selenium / Playwright Remote Grid URL + Auth Token + Max concurrency. Select it as the execution grid in Test Studio and Test Plans.",
    categories: ["All Plugins"],
    pro: true,
    fields: [
      field("gridUrl", "Remote Grid URL", "url", "https://grid.cgi.com/wd/hub"),
      field("authToken", "Auth Token", "password", "grid-auth-token"),
      field("maxConcurrency", "Max concurrency", "number", "8", false),
    ],
  },
  {
    key: "BACKLOG",
    name: "Backlog",
    mark: "B",
    color: "#2d8cff",
    description: "Nulab Backlog Space URL + API Key + Project Key. Sync issues and requirements.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    pro: true,
    fields: [
      field("spaceUrl", "Space URL", "url", "https://cgi.backlog.com"),
      field("apiKey", "API Key", "password", "backlog-api-key"),
      field("projectKey", "Project Key", "text", "DP"),
    ],
  },
  {
    key: "ZEPEL",
    name: "Zepel",
    mark: "Z",
    color: "#2563eb",
    description: "API Token + Workspace/Board. Sync features and user stories into Requirements.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    pro: true,
    fields: [
      field("apiToken", "API Token", "password", "zepel-api-token"),
      field("workspace", "Workspace", "text", "cgi"),
      field("board", "Board", "text", "Digital Portal"),
    ],
  },
  {
    key: "FRESHRELEASE",
    name: "Freshrelease",
    mark: "Fr",
    color: "#12b76a",
    description: "Domain + API Key + Project Key. Manage releases, requirements and bugs in one place.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    pro: true,
    fields: [
      field("domain", "Domain", "url", "https://cgi.freshrelease.com"),
      field("apiKey", "API Key", "password", "freshrelease-api-key"),
      field("projectKey", "Project Key", "text", "DP"),
    ],
  },
  {
    key: "MANTIS",
    name: "Mantis Bug Tracker",
    mark: "M",
    color: "#2f7d32",
    description: "MantisBT URL + API Token + Project Name. Automatically create and track anomalies.",
    categories: ["All Plugins", "Bug Reporting"],
    pro: true,
    fields: [
      field("url", "MantisBT URL", "url", "https://mantis.cgi.com"),
      field("apiToken", "API Token", "password", "mantis-api-token"),
      field("projectName", "Project Name", "text", "Digital Portal"),
    ],
  },
  {
    key: "GITHUB",
    name: "GitHub",
    mark: "GH",
    color: "#111827",
    description:
      "Connect a personal access token and repository so QASyn can list open pull requests, analyse impact and post verdict comments.",
    categories: ["All Plugins", "Product Management"],
    sourceControl: true,
    fields: [
      field("personalAccessToken", "Personal Access Token", "password", "ghp_••••••••"),
      field("organization", "Organization", "text", "cgi"),
      field("repository", "Repository", "text", "digital-portal", false, "Use owner/repository, e.g. cgi/digital-portal."),
      BASE_BRANCH,
    ],
  },
  {
    key: "GITLAB",
    name: "GitLab",
    mark: "GL",
    color: "#fc6d26",
    description: "Connect GitLab to analyse merge requests and keep your tests in step with code changes.",
    categories: ["All Plugins", "Product Management"],
    sourceControl: true,
    fields: [
      field("instanceUrl", "GitLab URL", "url", "https://gitlab.com"),
      field("accessToken", "Access Token", "password", "glpat-••••••••"),
      field("projectPath", "Project path", "text", "cgi/digital-portal"),
      BASE_BRANCH,
    ],
  },
  {
    key: "BITBUCKET",
    name: "Bitbucket",
    mark: "BB",
    color: "#0052cc",
    description: "Connect a Bitbucket workspace to inspect open pull requests and post quality verdicts.",
    categories: ["All Plugins", "Product Management"],
    sourceControl: true,
    fields: [
      field("workspace", "Workspace", "text", "cgi"),
      field("repository", "Repository", "text", "digital-portal"),
      field("username", "Username", "text", "qa-bot"),
      field("appPassword", "App Password", "password", "bitbucket-app-password"),
      BASE_BRANCH,
    ],
  },
  {
    key: "JIRA",
    name: "Jira",
    mark: "J",
    color: "#2684ff",
    description:
      "Stay connected to Jira: raise bugs, check status and rerun affected tests when a bug closes, without leaving QASyn.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    fields: [
      field("siteUrl", "Site URL", "url", "https://cgi.atlassian.net"),
      field("email", "Account e-mail", "text", "qa@cgi.com"),
      field("apiToken", "API Token", "password", "jira-api-token"),
      field("projectKey", "Project Key", "text", "DP"),
    ],
  },
  {
    key: "LINEAR",
    name: "Linear",
    mark: "L",
    color: "#5e6ad2",
    description:
      "Report a bug on Linear, track status and rerun on closure without leaving QASyn from the test case results page.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    fields: [
      field("apiKey", "API Key", "password", "lin_api_••••••••"),
      field("teamId", "Team ID", "text", "QA"),
    ],
  },
  {
    key: "SLACK",
    name: "Slack",
    mark: "#",
    color: "#611f69",
    description: "Connect Slack to get instant notifications for every run and every regression.",
    categories: ["All Plugins", "Bug Reporting"],
    fields: [
      field("webhookUrl", "Incoming webhook URL", "url", "https://hooks.slack.com/services/..."),
      field("channel", "Channel", "text", "#qa-alerts"),
    ],
  },
  {
    key: "TEAMS",
    name: "Microsoft Teams",
    mark: "MT",
    color: "#4f46e5",
    description: "Send release reports and regression alerts to a Microsoft Teams channel.",
    categories: ["All Plugins", "Bug Reporting"],
    fields: [
      field("webhookUrl", "Webhook URL", "url", "https://cgi.webhook.office.com/..."),
      field("channel", "Channel", "text", "QA alerts"),
    ],
  },
  {
    key: "CLICKUP",
    name: "ClickUp",
    mark: "C",
    color: "#7b68ee",
    description: "Report bugs on ClickUp, track status and rerun tests on closure from QASyn.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    fields: [
      field("apiToken", "API Token", "password", "pk_••••••••"),
      field("workspaceId", "Workspace ID", "text", "9012"),
      field("listId", "List ID", "text", "9012001"),
    ],
  },
  {
    key: "BIVIA",
    name: "QASyn Vision AI",
    mark: "B8",
    color: "#7c3aed",
    description:
      "Calibrated multimodal AI for visual verification, smart locator self-healing and PR impact analysis. QASyn Vision AI reads the DOM, screenshots and test context, then answers, grounds elements or abstains with a calibrated probability.",
    categories: ["All Plugins", "AI & Verification"],
    pro: true,
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "Paste your QASyn Vision AI API key",
        required: false,
        help: "Leave empty to use the workspace QASyn Vision AI credential.",
      },
      {
        key: "endpointUrl",
        label: "Endpoint URL",
        type: "url",
        placeholder: "Workspace default",
        required: false,
        help: "Leave empty to use the secure QASyn Vision AI cloud endpoint.",
      },
      {
        key: "defaultMode",
        label: "Default Mode",
        type: "select",
        required: false,
        defaultValue: "fast",
        options: [
          { value: "fast", label: "fast — low latency" },
          { value: "deep", label: "deep — higher reasoning" },
        ],
        help: "fast keeps every verification step under the 6-second budget; deep spends more reasoning on ambiguous screens.",
      },
      {
        key: "abstentionThreshold",
        label: "Abstention Threshold",
        type: "number",
        placeholder: "0.35",
        required: false,
        defaultValue: "0.35",
        min: 0,
        max: 1,
        step: 0.01,
        help: "Calibrated probability (0–1) below which QASyn Vision AI abstains instead of guessing.",
      },
    ],
  },
  {
    key: "QASYN_LAB",
    name: "QASyn Lab",
    mark: "QL",
    color: "#5b4ee8",
    description: "Connect a QASyn Lab workspace as your cloud execution lab.",
    categories: ["All Plugins"],
    fields: [
      field("labUrl", "Lab URL", "url", "https://lab.qasyn.com"),
      field("apiToken", "Lab API Token", "password", "lab-api-token"),
    ],
  },
];

export const PRO_PROVIDER_KEYS = INTEGRATION_PROVIDERS.filter((provider) => provider.pro).map((provider) => provider.key);
export const SOURCE_CONTROL_PROVIDER_KEYS = INTEGRATION_PROVIDERS.filter((provider) => provider.sourceControl).map((provider) => provider.key);
export const PROVIDER_KEYS = INTEGRATION_PROVIDERS.map((provider) => provider.key);

export function integrationDefinition(key: string): IntegrationDefinition | undefined {
  return INTEGRATION_PROVIDERS.find((provider) => provider.key === key);
}

export type IntegrationConfig = Record<string, string>;

export function parseIntegrationConfig(value: string | null | undefined): IntegrationConfig {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string" || typeof v === "number")
        .map(([k, v]) => [k, String(v)]),
    );
  } catch {
    return {};
  }
}

/** Returns human-readable validation errors for a provider configuration. */
export function validateIntegrationConfig(provider: string, config: IntegrationConfig): string[] {
  const definition = integrationDefinition(provider);
  if (!definition) return [`Unknown provider: ${provider}`];
  const errors: string[] = [];
  for (const field of definition.fields) {
    const value = (config[field.key] ?? "").trim();
    if (field.required && !value) {
      errors.push(`${field.label} is required.`);
      continue;
    }
    if (!value) continue;
    if (field.type === "url") {
      try {
        const parsed = new URL(value);
        if (!["http:", "https:"].includes(parsed.protocol)) errors.push(`${field.label} must use http or https.`);
      } catch {
        errors.push(`${field.label} must be a valid URL.`);
      }
    }
    if (field.type === "number") {
      const n = Number(value);
      const min = field.min ?? 1;
      const max = field.max ?? 500;
      if (!Number.isFinite(n) || n < min || n > max) errors.push(`${field.label} must be between ${min} and ${max}.`);
    }
    if (field.type === "password" && value.length < 4) {
      errors.push(`${field.label} looks too short.`);
    }
  }
  return errors;
}

/** Short, human-readable descriptor shown on the integration card. */
export function integrationDetail(provider: string, config: IntegrationConfig): string {
  const definition = integrationDefinition(provider);
  switch (provider) {
    case "GITHUB":
      return [config.organization, config.repository].filter(Boolean).join("/") || config.organization || "Repository connected";
    case "GITLAB":
      return config.projectPath || config.instanceUrl || "Project connected";
    case "BITBUCKET":
      return [config.workspace, config.repository].filter(Boolean).join("/") || "Workspace connected";
    case "AZURE_DEVOPS":
      return [config.organization, config.project].filter(Boolean).join(" / ") || "Organization connected";
    case "AZURE_VAULT":
      return config.vaultUri || "Vault connected";
    case "FIGMA":
      return config.fileKey || config.fileUrl || "Figma file connected";
    case "YOUTRACK":
      return `${config.instanceUrl || "YouTrack"} · ${config.projectId || "project"}`;
    case "CODESHIP":
      return config.projectUuid || "CI project connected";
    case "JENKINS":
      return `${config.jobName || "job"} · ${config.url || "Jenkins"}`;
    case "BUGZILLA":
      return [config.product, config.component].filter(Boolean).join(" / ") || "Bugzilla connected";
    case "TRELLO":
      return config.boardId ? `Board ${config.boardId}` : "Board connected";
    case "PRIVATE_GRID":
      return `${config.gridUrl || "Grid"} · ${config.maxConcurrency || 4} workers`;
    case "BACKLOG":
      return `${config.spaceUrl || "Backlog"} · ${config.projectKey || "project"}`;
    case "ZEPEL":
      return [config.workspace, config.board].filter(Boolean).join(" / ") || "Workspace connected";
    case "FRESHRELEASE":
      return `${config.domain || "Freshrelease"} · ${config.projectKey || "project"}`;
    case "MANTIS":
      return `${config.projectName || "Project"} · ${config.url || "MantisBT"}`;
    case "JIRA":
      return `${config.siteUrl || "Jira"} · ${config.projectKey || "project"}`;
    case "LINEAR":
      return `Team ${config.teamId || "QA"}`;
    case "SLACK":
    case "TEAMS":
      return config.channel || "Channel connected";
    case "CLICKUP":
      return `Workspace ${config.workspaceId || "connected"}`;
    case "BIVIA":
      return `${config.defaultMode || "fast"} mode · ${config.abstentionThreshold || "0.35"} threshold`;
    case "QASYN_LAB":
      return config.labUrl || "Lab connected";
    default:
      return definition?.name ?? provider;
  }
}

/** Parse NAME=value lines used by the Azure Key Vault sync. */
export function parseSecretLines(raw: string | undefined): Array<{ name: string; value: string }> {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return { name: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
    })
    .filter((entry) => /^[A-Z][A-Z0-9_]{1,60}$/.test(entry.name));
}
