import type { Focus, OsKey, Plan, Provider } from "./types";

export const PLAN_CREDITS: Record<Plan, number> = { trial: 3000, free: 500, starter: 2000, pro: 12_000, enterprise: 250_000 };
export const PLAN_INFO: Record<Plan, { label: string; price: string; blurb: string }> = {
  trial: { label: "Trial", price: "$0", blurb: "15 days · 3,000 credits" },
  free: { label: "Free", price: "$0/mo", blurb: "500 credits / month" },
  starter: { label: "Starter", price: "$249/mo", blurb: "10,000 credits / month" },
  pro: { label: "Pro", price: "$899/mo", blurb: "50,000 credits / month" },
  enterprise: { label: "Enterprise", price: "Custom", blurb: "250,000 credits · SSO · SLA" },
};

export const TOTAL_STEPS = 7;
export const TRIAL_DAYS = 15;
export const TRIAL_CREDITS = 3000;

/** Credit cost of simulated platform actions (deducted from the organisation balance). */
export const CREDIT_COSTS = {
  crawl: 50,
  testRun: 5,
  aiGeneration: 10,
  prAnalysis: 25,
  suiteRun: 20,
  codeAnalysis: 30,
} as const;

/**
 * The eleven QASyn test types. Persisted on TestCase.variablesJson under the
 * hidden `_testType` key so existing SQLite databases remain compatible.
 */
export const TEST_TYPES = [
  "Functional",
  "End-to-End (E2E)",
  "Regression",
  "Smoke",
  "Sanity",
  "Load",
  "Performance",
  "Security",
  "Penetration",
  "API",
  "Accessibility",
] as const;
export type TestType = (typeof TEST_TYPES)[number];
export const DEFAULT_TEST_TYPE: TestType = "Functional";

export const STEPS = [
  { n: 1, kicker: "WHAT YOU'RE BUILDING", label: "Describe" },
  { n: 2, kicker: "CONTEXT", label: "Context" },
  { n: 3, kicker: "CONNECT CODE", label: "Code" },
  { n: 4, kicker: "BUG TRACKER", label: "Bug tracker" },
  { n: 5, kicker: "FOCUS", label: "Focus" },
  { n: 6, kicker: "TEAM", label: "Team" },
  { n: 7, kicker: "TRIAL", label: "Trial" },
] as const;

export const APP_DESCRIPTION_MAX = 2500;

export const FOCUS_OPTIONS: Array<{ key: Focus; label: string; description: string }> = [
  { key: "PR_IMPACT", label: "Test every pull request", description: "Impact analysis and targeted regressions before merge." },
  { key: "BUG_REPRO", label: "Reproduce incoming bugs", description: "Automatic triage, reproduction and root cause." },
  { key: "REGRESSIONS", label: "Grow regression coverage", description: "Crawl the app and generate a baseline suite." },
  { key: "PROD_SIGNALS", label: "Learn from production", description: "Turn session anomalies into permanent tests." },
];

export const OS_OPTIONS: Array<{ value: OsKey; label: string }> = [
  { value: "MACOS", label: "macOS" },
  { value: "LINUX", label: "Linux" },
  { value: "WINDOWS", label: "Windows" },
];

export interface ProviderMeta {
  name: string;
  short: string;
  description: string;
  tile: string;
  indexes: boolean;
  detailLabel?: string;
  detailPlaceholder?: string;
}

export const PROVIDER_META: Record<Provider, ProviderMeta> = {
  GITHUB: {
    name: "GitHub",
    short: "GH",
    description: "Pull requests, commits and CI checks.",
    tile: "bg-slate-900 text-white",
    indexes: true,
    detailLabel: "Repository",
    detailPlaceholder: "owner/repository",
  },
  GITLAB: {
    name: "GitLab",
    short: "GL",
    description: "Merge requests and pipelines.",
    tile: "bg-orange-500 text-white",
    indexes: true,
    detailLabel: "Project",
    detailPlaceholder: "group/project",
  },
  JIRA: {
    name: "Jira",
    short: "J",
    description: "Raise, reproduce and close bugs.",
    tile: "bg-blue-600 text-white",
    indexes: false,
    detailLabel: "Project key",
    detailPlaceholder: "ACME",
  },
  LINEAR: {
    name: "Linear",
    short: "L",
    description: "Turn issues into reproduced bugs.",
    tile: "bg-indigo-500 text-white",
    indexes: false,
    detailLabel: "Team",
    detailPlaceholder: "ENG",
  },
  SLACK: {
    name: "Slack",
    short: "S",
    description: "Run notifications and bug intake.",
    tile: "bg-fuchsia-700 text-white",
    indexes: false,
    detailLabel: "Channel",
    detailPlaceholder: "#qa-alerts",
  },
  BIVIA: {
    name: "QASyn Vision AI",
    short: "B8",
    description: "Calibrated multimodal AI for visual verification, smart locators and PR impact.",
    tile: "bg-[#111827] text-white",
    indexes: false,
    detailLabel: "Default mode",
    detailPlaceholder: "fast",
  },
};

export const CODE_PROVIDERS: Provider[] = ["GITHUB", "GITLAB"];
export const TRACKER_PROVIDERS: Provider[] = ["JIRA", "LINEAR"];

export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "dashboard", "onboard", "onboarding", "qasyn", "settings", "www", "login", "signup", "accounts",
]);

/** Consumer mailbox domains: never used for "your company already uses QASyn" detection. */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com",
  "proton.me", "protonmail.com", "aol.com", "gmx.com", "yandex.com", "mail.com", "orange.fr", "free.fr", "laposte.net",
]);

export const COLLECTION_KINDS = ["suites", "test-plans"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];
export const isCollectionKind = (k: string): k is CollectionKind => (COLLECTION_KINDS as readonly string[]).includes(k);

export const DEMO_ORG_SLUG = "acme";
export const DEMO_EMAIL = "demo@acme.dev";
export const DEMO_PASSWORD = "AcmeDemo2026!";
