/**
 * Types partagés client / serveur.
 * Les valeurs "enum" sont stockées en String dans SQLite (voir prisma/schema.prisma).
 */

export const PROVIDERS = ["GITHUB", "GITLAB", "JIRA", "LINEAR", "SLACK"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const INTEGRATION_STATUSES = ["CONNECTED", "INDEXING", "FAILED"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const REACH_TYPES = ["TEAM_ENV", "LOCALHOST"] as const;
export type ReachType = (typeof REACH_TYPES)[number];

export const OS_KEYS = ["MACOS", "LINUX", "WINDOWS"] as const;
export type OsKey = (typeof OS_KEYS)[number];

export const FOCUS_KEYS = ["PR_IMPACT", "BUG_REPRO", "REGRESSIONS", "PROD_SIGNALS"] as const;
export type Focus = (typeof FOCUS_KEYS)[number];

export type RunStatus = "SUCCESS" | "FAILED";
export type LogStream = "stdout" | "stderr";
export type LogTag = "DEPLOY" | "TEST" | "PR" | "BUG" | "RCA" | "FIX" | "INFO" | "WARN" | "FAIL";

export interface OrganisationDraft {
  /** null tant que l'organisation n'est pas créée en base */
  id: string | null;
  name: string;
  slug: string;
  ownerName: string;
  website: string;
  addWebsiteToKb: boolean;
}

export interface IntegrationDTO {
  provider: Provider;
  status: IntegrationStatus;
  detail: string | null;
}

/** État global de l'onboarding, partagé via OnboardingContext. */
export interface OnboardingState {
  organisation: OrganisationDraft;
  currentStep: number;
  appDescription: string;
  reachType: ReachType | null;
  environmentUrl: string;
  selectedOs: OsKey | null;
  localPort: number;
  tunnelToken: string | null;
  focus: Focus | null;
  teamInvites: string[];
  integrations: IntegrationDTO[];
  completed: boolean;
}

export interface RunDTO {
  id: string;
  release: number;
  version: string;
  title: string;
  branch: string | null;
  prNumber: number | null;
  status: RunStatus;
  qualityScore: number;
  coverage: number;
  costAvoided: number;
  codeChanges: number;
  impactedTests: number;
  regressionsCaught: number;
  anomaliesReproduced: number;
  testsAdded: number;
  testsTotal: number;
  testsPassed: number;
  durationMs: number;
  createdAt: string;
}

export interface LogDTO {
  id: string;
  timestamp: string;
  stream: LogStream;
  tag: LogTag;
  message: string;
}
