import type { Focus, OsKey, Provider, ReachType } from "./types";

export const TOTAL_STEPS = 7;

export const STEPS = [
  {
    n: 1,
    label: "Describe",
    title: "Tell us what you're building",
    subtitle: "Describe your product in plain language. Ship uses it to understand what “working” means.",
  },
  {
    n: 2,
    label: "Environment",
    title: "Where can QASyn reach it?",
    subtitle: "Point Ship at a deployed environment, or open a secure tunnel to the app running on your machine.",
  },
  {
    n: 3,
    label: "Code",
    title: "Connect your code",
    subtitle: "Ship reads your repository once to map flows, then analyses every pull request.",
  },
  {
    n: 4,
    label: "Bug tracker",
    title: "Connect your bug tracker",
    subtitle: "Ship picks up incoming bugs, reproduces them and attaches evidence. You can skip this for now.",
  },
  {
    n: 5,
    label: "Focus",
    title: "Choose a priority",
    subtitle: "Tell Ship where to start. You can change this at any time.",
  },
  {
    n: 6,
    label: "Team",
    title: "Invite your team",
    subtitle: "No per-seat pricing — invite everyone who ships code.",
  },
  {
    n: 7,
    label: "Launch",
    title: "Review and launch",
    subtitle: "Ship runs a first analysis and opens your dashboard.",
  },
] as const;

export const APP_DESCRIPTION_MAX = 2500;
export const APP_DESCRIPTION_MIN = 20;

export const FOCUS_OPTIONS: Array<{ key: Focus; label: string; description: string }> = [
  { key: "PR_IMPACT", label: "Test every pull request", description: "Impact analysis and targeted regressions before merge." },
  { key: "BUG_REPRO", label: "Reproduce incoming bugs", description: "Automatic triage, reproduction and root cause." },
  { key: "REGRESSIONS", label: "Grow regression coverage", description: "Crawl the app and generate a baseline suite." },
  { key: "PROD_SIGNALS", label: "Learn from production", description: "Turn session anomalies into permanent tests." },
];

export const REACH_OPTIONS: Array<{ key: ReachType; label: string; description: string }> = [
  { key: "TEAM_ENV", label: "Your team's environment", description: "A staging or QA URL your team already deploys to." },
  { key: "LOCALHOST", label: "Localhost, right now", description: "Open a secure tunnel to the app running on your machine." },
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
  /** Classe Tailwind de la tuile d'icône */
  tile: string;
  /** Les dépôts de code passent par un état INDEXING avant CONNECTED */
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
};

export const CODE_PROVIDERS: Provider[] = ["GITHUB", "GITLAB"];
export const TRACKER_PROVIDERS: Provider[] = ["JIRA", "LINEAR", "SLACK"];

/** Slugs réservés (routes de l'application) */
export const RESERVED_SLUGS = new Set(["admin", "api", "app", "dashboard", "onboard", "onboarding", "qasyn", "settings", "www"]);
