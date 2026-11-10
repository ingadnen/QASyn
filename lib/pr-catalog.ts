/**
 * Deterministic catalogue of open pull requests for connected source-control
 * providers. External provider APIs are not reachable from the local demo, so
 * this module exposes the same shape the real API returns: provider,
 * repository, PR number, title, branches, author, opened date and files.
 *
 * The data is stable per repository and organisation so the Pull Requests
 * module can list real selections instead of asking for a free-form number.
 */

export interface SourceIntegrationLike {
  provider: string;
  status: string;
  config: Record<string, string>;
}

export interface SourceRepository {
  provider: string;
  providerName: string;
  repository: string;
  baseBranch: string;
}

export interface CatalogPullRequest {
  provider: string;
  repository: string;
  number: number;
  title: string;
  branch: string;
  branchTarget: string;
  author: string;
  openedAt: string;
  files: string[];
  additions: number;
  deletions: number;
  url: string;
}

const PROVIDER_NAMES: Record<string, string> = {
  GITHUB: "GitHub",
  GITLAB: "GitLab",
  BITBUCKET: "Bitbucket",
  AZURE_DEVOPS: "Azure DevOps",
};

const SOURCE_PROVIDERS = Object.keys(PROVIDER_NAMES);

/** Extracts the connected repositories from the organisation's integrations. */
export function sourceRepositories(integrations: SourceIntegrationLike[]): SourceRepository[] {
  const sources: SourceRepository[] = [];
  for (const integration of integrations) {
    if (integration.status !== "CONNECTED" || !SOURCE_PROVIDERS.includes(integration.provider)) continue;
    const config = integration.config ?? {};
    let repository = "";
    if (integration.provider === "GITHUB") {
      const org = (config.organization ?? "").trim();
      const repo = (config.repository ?? "").trim();
      repository = repo.includes("/") ? repo : org && repo ? `${org}/${repo}` : repo || org;
    } else if (integration.provider === "GITLAB") {
      repository = (config.projectPath ?? "").trim();
    } else if (integration.provider === "BITBUCKET") {
      const workspace = (config.workspace ?? "").trim();
      const repo = (config.repository ?? "").trim();
      repository = repo.includes("/") ? repo : workspace && repo ? `${workspace}/${repo}` : repo || workspace;
    } else if (integration.provider === "AZURE_DEVOPS") {
      const org = (config.organization ?? "").trim();
      const repo = (config.repository ?? "").trim();
      repository = repo.includes("/") ? repo : org && repo ? `${org}/${repo}` : repo || org;
    }
    if (!repository) continue;
    sources.push({
      provider: integration.provider,
      providerName: PROVIDER_NAMES[integration.provider] ?? integration.provider,
      repository,
      baseBranch: (config.baseBranch ?? "main").trim() || "main",
    });
  }
  return sources;
}

interface Template {
  title: string;
  branch: string;
  author: string;
  files: string[];
  additions: number;
  deletions: number;
}

const TEMPLATES: Template[] = [
  {
    title: "Add wallet payments to checkout",
    branch: "feat/wallet-payments",
    author: "priya",
    files: [
      "src/checkout/wallet.tsx",
      "src/checkout/payment-form.tsx",
      "src/checkout/checkout-session.ts",
      "src/api/payments/route.ts",
      "src/billing/invoice.ts",
      "src/ui/components/WalletButton.tsx",
    ],
    additions: 412,
    deletions: 38,
  },
  {
    title: "Refactor invoice PDF renderer",
    branch: "chore/invoice-pdf",
    author: "sam",
    files: [
      "src/billing/invoice-pdf.ts",
      "src/billing/templates/invoice.html",
      "src/api/invoices/[id]/route.ts",
      "src/billing/download.ts",
    ],
    additions: 186,
    deletions: 204,
  },
  {
    title: "Fix checkout session handling after token refresh",
    branch: "fix/checkout-session",
    author: "alex",
    files: [
      "src/checkout/session.ts",
      "src/auth/refresh.ts",
      "src/checkout/cart.tsx",
      "src/api/checkout/route.ts",
      "src/checkout/guest.ts",
      "src/auth/session.ts",
      "src/checkout/checkout-session.test.ts",
    ],
    additions: 96,
    deletions: 71,
  },
  {
    title: "Harden SSO callback validation",
    branch: "fix/sso-callback",
    author: "nadia",
    files: [
      "src/auth/sso/callback.ts",
      "src/auth/session.ts",
      "src/auth/login.tsx",
      "src/middleware.ts",
    ],
    additions: 64,
    deletions: 22,
  },
  {
    title: "Proration preview for plan changes",
    branch: "feat/proration-preview",
    author: "claire",
    files: [
      "src/billing/proration.ts",
      "src/billing/plans.tsx",
      "src/api/subscriptions/route.ts",
      "src/billing/invoice.ts",
      "src/billing/plan-change.test.ts",
    ],
    additions: 228,
    deletions: 47,
  },
  {
    title: "Improve address form validation",
    branch: "feat/address-validation",
    author: "sam",
    files: [
      "src/checkout/address-form.tsx",
      "src/checkout/validation.ts",
      "src/checkout/shipping.ts",
    ],
    additions: 118,
    deletions: 35,
  },
  {
    title: "Add team role guard to settings",
    branch: "feat/team-role-guard",
    author: "priya",
    files: [
      "src/settings/team/role-guard.ts",
      "src/settings/team/page.tsx",
      "src/api/team/[id]/route.ts",
      "src/auth/permissions.ts",
    ],
    additions: 154,
    deletions: 19,
  },
  {
    title: "Bump UI kit to v5",
    branch: "deps/ui-kit-5",
    author: "alex",
    files: ["src/ui/button.tsx", "src/ui/modal.tsx", "src/ui/theme.ts", "package.json"],
    additions: 58,
    deletions: 52,
  },
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) % 100_000;
  return h;
}

/** Open pull requests exposed for one connected repository. */
export function openPullRequests(provider: string, repository: string): CatalogPullRequest[] {
  const base = 700 + (hash(`${provider}:${repository}`) % 60);
  const day = 86_400_000;
  return TEMPLATES.map((template, index) => {
    const number = base + index;
    return {
      provider,
      repository,
      number,
      title: template.title,
      branch: template.branch,
      branchTarget: "main",
      author: template.author,
      openedAt: new Date(Date.now() - (index + 1) * day - (index % 3) * 3_600_000).toISOString(),
      files: template.files,
      additions: template.additions,
      deletions: template.deletions,
      url: `https://${provider === "GITLAB" ? "gitlab.com" : provider === "BITBUCKET" ? "bitbucket.org" : provider === "AZURE_DEVOPS" ? "dev.azure.com" : "github.com"}/${repository}/pull/${number}`,
    };
  });
}

const MODULE_HINTS: Array<{ module: string; words: string[] }> = [
  { module: "Checkout", words: ["checkout", "cart", "wallet", "payment", "order", "shipping", "address"] },
  { module: "Billing", words: ["billing", "invoice", "subscription", "plan", "proration", "discount", "vat"] },
  { module: "Settings", words: ["settings", "team", "role", "permission", "token", "organization", "workspace"] },
  { module: "Core", words: ["auth", "login", "session", "sso", "refresh", "user", "middleware", "ui/"] },
];

/** Maps changed file paths to the product modules they can impact. */
export function impactedModules(files: string[]): string[] {
  const modules = new Set<string>();
  for (const file of files) {
    const lower = file.toLowerCase();
    for (const hint of MODULE_HINTS) {
      if (hint.words.some((word) => lower.includes(word))) modules.add(hint.module);
    }
  }
  if (modules.size === 0) modules.add("Core");
  return [...modules];
}

export function blastRadius(files: string[], modules: string[]): "contained" | "moderate" | "wide" {
  if (files.length >= 6 || modules.length >= 3) return "wide";
  if (files.length >= 3 || modules.length >= 2) return "moderate";
  return "contained";
}

/** Extracts provider, repository and PR number from a custom PR URL. */
export function parseCustomPrUrl(raw: string): { provider: string; repository: string; prNumber: number } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const number = Number(url.searchParams.get("pr") ?? segments[segments.length - 1]);
  if (!Number.isInteger(number) || number < 1) return null;
  const host = url.hostname.toLowerCase();
  if (host.includes("github")) {
    const index = segments.indexOf("pull");
    if (index >= 2) return { provider: "GITHUB", repository: `${segments[0]}/${segments[1]}`, prNumber: number };
  }
  if (host.includes("gitlab")) {
    const index = segments.indexOf("merge_requests");
    if (index >= 2) return { provider: "GITLAB", repository: segments.slice(0, index).join("/"), prNumber: number };
  }
  if (host.includes("bitbucket")) {
    const index = segments.indexOf("pull-requests");
    if (index >= 2) return { provider: "BITBUCKET", repository: `${segments[0]}/${segments[1]}`, prNumber: number };
  }
  if (host.includes("dev.azure")) {
    return { provider: "AZURE_DEVOPS", repository: segments.slice(2).join("/"), prNumber: number };
  }
  return null;
}

export interface ImpactSummary {
  files: string[];
  modules: string[];
  blastRadius: "contained" | "moderate" | "wide";
  impacted: Array<{ id: string; title: string; module: string; criticality: string; status: string }>;
  executed: Array<{ id: string; title: string; status: string }>;
  passed: number;
  failed: number;
  total: number;
  testsSelected: number;
  verdict: "passed_baseline" | "regression_caught";
  comment: string;
}

export function buildProviderComment(input: {
  prNumber: number;
  title: string;
  organisation: string;
  impact: Omit<ImpactSummary, "comment" | "verdict"> & { verdict: "passed_baseline" | "regression_caught" };
}): string {
  const { prNumber, title, organisation, impact } = input;
  const verdict = impact.verdict === "regression_caught" ? "⚠️ Regressions caught" : "✅ Passed baseline";
  const lines = [
    `## QASyn PR check — ${verdict}`,
    "",
    `**Pull request:** #${prNumber} ${title}`,
    `**Repository:** ${impact.modules.join(", ") || "Core"} blast radius · ${impact.blastRadius}`,
    `**Changed files:** ${impact.files.length}`,
    `**Impacted tests executed:** ${impact.total}`,
    `**Result:** ${impact.passed} passed · ${impact.failed} failed`,
    "",
    "### Blast radius",
    ...impact.files.slice(0, 12).map((file) => `- \`${file}\``),
    "",
    "### Impacted test cases",
    ...impact.executed.slice(0, 12).map((test) => `- ${test.status === "passing" ? "✅" : "❌"} ${test.title}`),
    "",
    `_Posted automatically by QASyn for ${organisation}._`,
  ];
  return lines.join("\n");
}

/** Serialises a PullRequestCheck row for the client, including parsed detail. */
export function prDetail(row: {
  id: string;
  prNumber: number;
  title: string;
  branch: string;
  branchTarget: string;
  author: string;
  provider: string | null;
  repository: string | null;
  externalUrl: string | null;
  riskLevel: string;
  status: string;
  filesChanged: number;
  changedFilesJson: string;
  impactJson: string;
  logsJson: string;
  commentBody: string | null;
  commentPosted: boolean;
  testsRun: number;
  regressions: number;
  createdAt: Date;
}) {
  const parse = <T,>(value: string, fallback: T): T => {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };
  return {
    id: row.id,
    prNumber: row.prNumber,
    title: row.title,
    branch: row.branch,
    branchTarget: row.branchTarget,
    author: row.author,
    provider: row.provider,
    repository: row.repository,
    externalUrl: row.externalUrl,
    riskLevel: row.riskLevel,
    status: row.status,
    filesChanged: row.filesChanged,
    files: parse<string[]>(row.changedFilesJson, []),
    impact: parse<Record<string, unknown>>(row.impactJson, {}),
    logs: parse<Array<{ at: string; level: string; message: string }>>(row.logsJson, []),
    commentBody: row.commentBody,
    commentPosted: row.commentPosted,
    testsRun: row.testsRun,
    regressions: row.regressions,
    createdAt: row.createdAt.toISOString(),
  };
}
