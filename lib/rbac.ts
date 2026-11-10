/**
 * Role-based access control (RBAC) for QASyn.
 *
 * Four-role model used across the dashboard, APIs and MCP guides:
 * - Admin      : full workspace access.
 * - QA         : test lifecycle (cases, suites, plans, runs, environments).
 * - Engineer   : PRs, code analysis, tunnels, integrations and read-only settings.
 * - BA / FA    : requirements, review and reporting; no billing or token access.
 *
 * Founder and Eng manager are kept as legacy workspace roles with broad access.
 * Permissions are additive; the sidebar and API guards use the same mapping.
 */

import type { UserRole } from "./types";

export const PERMISSIONS = [
  "overview",
  "pullRequests",
  "prRun",
  "crawl",
  "crawlRun",
  "codeAnalysis",
  "requirements",
  "requirementsEdit",
  "testCases",
  "testCasesEdit",
  "plans",
  "plansEdit",
  "environments",
  "uploads",
  "knowledgeBase",
  "team",
  "teamManage",
  "tunnels",
  "tunnelsManage",
  "integrations",
  "integrationsManage",
  "billing",
  "billingManage",
  "mcp",
  "mcpTokens",
  "settings",
  "settingsManage",
  "apiTokens",
  "apiTokensManage",
  "audits",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

/** Role → allowed permissions. Unknown roles fall back to the least-privileged set. */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  Admin: ALL,
  Founder: ALL,
  "Eng manager": [
    "overview",
    "pullRequests",
    "prRun",
    "crawl",
    "crawlRun",
    "codeAnalysis",
    "requirements",
    "requirementsEdit",
    "testCases",
    "testCasesEdit",
    "plans",
    "plansEdit",
    "environments",
    "uploads",
    "knowledgeBase",
    "team",
    "teamManage",
    "tunnels",
    "tunnelsManage",
    "integrations",
    "integrationsManage",
    "mcp",
    "settings",
    "settingsManage",
    "audits",
  ],
  Engineer: [
    "overview",
    "pullRequests",
    "prRun",
    "crawl",
    "crawlRun",
    "codeAnalysis",
    "requirements",
    "requirementsEdit",
    "testCases",
    "testCasesEdit",
    "plans",
    "plansEdit",
    "environments",
    "uploads",
    "knowledgeBase",
    "tunnels",
    "tunnelsManage",
    "integrations",
    "integrationsManage",
    "mcp",
    "mcpTokens",
    "settings",
  ],
  QA: [
    "overview",
    "crawl",
    "crawlRun",
    "requirements",
    "requirementsEdit",
    "testCases",
    "testCasesEdit",
    "plans",
    "plansEdit",
    "environments",
    "uploads",
    "knowledgeBase",
    "integrations",
    "mcp",
    "mcpTokens",
  ],
  "BA / FA": ["overview", "requirements", "requirementsEdit", "testCases", "plans", "knowledgeBase", "mcp"],
};

const ROLE_ALIASES: Record<string, UserRole> = {
  admin: "Admin",
  founder: "Founder",
  "eng manager": "Eng manager",
  "engineering manager": "Eng manager",
  engineer: "Engineer",
  developer: "Engineer",
  dev: "Engineer",
  qa: "QA",
  "qa engineer": "QA",
  "ba / fa": "BA / FA",
  "ba/fa": "BA / FA",
  ba: "BA / FA",
  fa: "BA / FA",
  "business analyst": "BA / FA",
  "functional analyst": "BA / FA",
  manager: "BA / FA",
  "simple user": "BA / FA",
};

/** Normalises a stored role string (case/alias tolerant). */
export function normalizeRole(role: string | null | undefined): UserRole {
  if (!role) return "BA / FA";
  return ROLE_ALIASES[role.trim().toLowerCase()] ?? "BA / FA";
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].includes(permission);
}

export function permissionsFor(role: string | null | undefined): Set<Permission> {
  return new Set(ROLE_PERMISSIONS[normalizeRole(role)]);
}

/** Human-readable role label for the sidebar / team table. */
export function roleLabel(role: string | null | undefined): string {
  return normalizeRole(role);
}
