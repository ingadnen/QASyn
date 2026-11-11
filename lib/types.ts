/**
 * Shared client / server types.
 * "Enum" values are stored as String in SQLite (see prisma/schema.prisma).
 */

export const PROVIDERS = ["GITHUB", "GITLAB", "JIRA", "LINEAR", "SLACK", "BIVIA"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const INTEGRATION_STATUSES = ["CONNECTED", "INDEXING", "FAILED"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const USER_ROLES = ["Super Admin", "Engineer", "QA", "Eng manager", "Founder", "Admin", "BA / FA"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PLANS = ["trial", "free", "starter", "pro", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

export const REACH_MODES = ["staging", "localhost"] as const;
export type ReachMode = (typeof REACH_MODES)[number];

export const APP_LOGIN_TYPES = ["none", "signup_test_account", "credentials"] as const;
export type AppLoginType = (typeof APP_LOGIN_TYPES)[number];

export const PAIN_POINTS = ["Escaped bugs", "Behavior drift", "Slow code reviews", "Flaky tests", "PR checks"] as const;
export type PainPoint = (typeof PAIN_POINTS)[number];

export const ONBOARDING_ROLES = ["Engineer", "QA", "Eng manager", "Founder"] as const;
export type OnboardingRole = (typeof ONBOARDING_ROLES)[number];

export const TESTING_MATURITY = ["Nothing yet", "Manual QA", "Some automation", "Mature suite"] as const;
export type TestingMaturity = (typeof TESTING_MATURITY)[number];

export const FOCUS_KEYS = ["PR_IMPACT", "BUG_REPRO", "REGRESSIONS", "PROD_SIGNALS"] as const;
export type Focus = (typeof FOCUS_KEYS)[number];

export const OS_KEYS = ["MACOS", "LINUX", "WINDOWS"] as const;
export type OsKey = (typeof OS_KEYS)[number];

export const TEST_STATUSES = ["passing", "failing", "draft", "flaky"] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

export const CRITICALITIES = ["critical", "high", "medium", "low"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const BUG_STATUSES = ["reproduced", "open", "fixed"] as const;
export const PR_STATUSES = ["passed_baseline", "regression_caught", "running"] as const;
export type PrStatus = (typeof PR_STATUSES)[number];
export const RISK_LEVELS = ["low", "medium", "high"] as const;
export const CRAWL_STATUSES = ["running", "completed", "failed"] as const;
export type CrawlStatus = (typeof CRAWL_STATUSES)[number];
export const COVERAGE_STATUSES = ["covered", "partial", "uncovered"] as const;
export const KNOWLEDGE_TYPES = ["website", "doc", "openapi", "upload"] as const;
export const AUTH_TYPES = ["none", "basic", "bearer", "form"] as const;
export const SCHEDULES = ["manual", "on_pr", "nightly", "weekly"] as const;
export const UPLOAD_KINDS = ["apk", "ipa", "har", "postman", "video", "other"] as const;

export type RunStatus = "SUCCESS" | "FAILED";
export type LogStream = "stdout" | "stderr";
export type LogTag = "DEPLOY" | "TEST" | "PR" | "BUG" | "RCA" | "FIX" | "INFO" | "WARN" | "FAIL" | "CRAWL" | "MAP" | "DONE";

export interface OrganisationDraft {
  id: string | null;
  name: string;
  slug: string;
  ownerName: string;
  website: string;
  addToKnowledgeBase: boolean;
  logoUrl: string | null;
}

export interface IntegrationDTO {
  provider: Provider;
  status: IntegrationStatus;
  detail: string | null;
}

export interface CrawlSummary {
  id: string;
  targetUrl: string;
  status: CrawlStatus;
  startedAt: string;
}

/** Global onboarding state, shared through OnboardingContext. */
export interface OnboardingState {
  organisation: OrganisationDraft;
  currentStep: number;
  appDescription: string;
  reachMode: ReachMode | null;
  environmentUrl: string;
  localPort: number;
  /** Full token: only ever sent to the organisation owner during onboarding / on /dashboard/tunnels */
  tunnelToken: string | null;
  tunnelEnrolled: boolean;
  appLoginType: AppLoginType | null;
  appLoginUsername: string;
  hasAppLoginPassword: boolean;
  painPoints: PainPoint[];
  userRole: OnboardingRole | null;
  testingMaturity: TestingMaturity | null;
  focusPriority: Focus | null;
  invitedEmails: string[];
  integrations: IntegrationDTO[];
  completed: boolean;
  crawl: CrawlSummary | null;
  trialEndsAt: string | null;
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
  regressionsCaught: number;
  testsTotal: number;
  testsPassed: number;
  createdAt: string;
}

export interface LogDTO {
  id: string;
  timestamp: string;
  stream: LogStream;
  tag: LogTag;
  message: string;
}

export interface CrawlLogLine {
  offsetMs: number;
  tag: LogTag;
  message: string;
}
