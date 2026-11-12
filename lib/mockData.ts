/**
 * Données simulées (pure data, sans dépendance Prisma).
 * Utilisées par prisma/seed.ts et par la fin d'onboarding (étape 7)
 * pour générer l'historique de releases et les logs du terminal AQE.
 */
import type { LogStream, LogTag, RunStatus } from "./types";

export interface ReleaseTemplate {
  version: string;
  title: string;
  branch: string;
  prNumber: number;
  status: RunStatus;
  flows: string[];
  /** Tests en échec affichés sur stderr */
  failures: string[];
  bug?: { id: number; summary: string; rootCause: string };
  anomaly?: string;
  qualityScore: number;
  coverage: number;
  costAvoided: number;
  codeChanges: number;
  impactedTests: number;
  regressionsCaught: number;
  testsAdded: number;
  testsTotal: number;
  testsPassed: number;
  durationMs: number;
}

/**
 * Historique de 8 releases (de la plus ancienne à la plus récente).
 * La dernière reproduit le "Release Quality Report" : score 92/100 (↑ 8),
 * 94 % de couverture, 31 changements, 47 tests impactés, 3 régressions,
 * 1 anomalie reproduite, 2 tests ajoutés, 18,4 k$ de coût de défaut évité.
 */
export const RELEASE_TEMPLATES: ReleaseTemplate[] = [
  {
    version: "v2.7.4",
    title: "Add saved carts",
    branch: "feat/saved-carts",
    prNumber: 1188,
    status: "SUCCESS",
    flows: ["cart", "checkout"],
    failures: ["cart.spec › saved cart survives logout"],
    qualityScore: 71,
    coverage: 78,
    costAvoided: 6200,
    codeChanges: 18,
    impactedTests: 26,
    regressionsCaught: 1,
    testsAdded: 1,
    testsTotal: 112,
    testsPassed: 111,
    durationMs: 252_000,
  },
  {
    version: "v2.7.5",
    title: "Refactor auth middleware",
    branch: "refactor/auth-middleware",
    prNumber: 1194,
    status: "SUCCESS",
    flows: ["auth", "account"],
    failures: ["auth.spec › remember-me cookie is renewed"],
    bug: {
      id: 801,
      summary: "password reset link expires immediately",
      rootCause: "TTL read in ms instead of seconds in auth/reset.ts:42",
    },
    qualityScore: 74,
    coverage: 81,
    costAvoided: 7900,
    codeChanges: 22,
    impactedTests: 30,
    regressionsCaught: 1,
    testsAdded: 2,
    testsTotal: 118,
    testsPassed: 117,
    durationMs: 281_000,
  },
  {
    version: "v2.7.6",
    title: "Migrate payments SDK to v5",
    branch: "chore/payments-sdk-v5",
    prNumber: 1203,
    status: "FAILED",
    flows: ["payments", "checkout", "billing"],
    failures: [
      "payments.spec › 3-D Secure challenge resolves",
      "billing.spec › JPY amounts are not rounded",
      "checkout.spec › refund appears in order history",
    ],
    anomaly: "duplicate charge attempts on slow 3G sessions",
    qualityScore: 69,
    coverage: 80,
    costAvoided: 5100,
    codeChanges: 27,
    impactedTests: 35,
    regressionsCaught: 2,
    testsAdded: 1,
    testsTotal: 124,
    testsPassed: 119,
    durationMs: 344_000,
  },
  {
    version: "v2.7.7",
    title: "Improve search ranking",
    branch: "feat/search-ranking",
    prNumber: 1209,
    status: "SUCCESS",
    flows: ["search", "catalog"],
    failures: ["search.spec › empty query shows trending items"],
    qualityScore: 77,
    coverage: 85,
    costAvoided: 9800,
    codeChanges: 19,
    impactedTests: 28,
    regressionsCaught: 1,
    testsAdded: 2,
    testsTotal: 129,
    testsPassed: 128,
    durationMs: 263_000,
  },
  {
    version: "v2.7.8",
    title: "Redesign billing page",
    branch: "feat/billing-redesign",
    prNumber: 1215,
    status: "FAILED",
    flows: ["billing", "account", "auth"],
    failures: [
      "billing.spec › invoice download returns PDF",
      "billing.spec › plan downgrade keeps add-ons",
      "account.spec › VAT number is persisted",
    ],
    bug: {
      id: 817,
      summary: "invoices page blank for EU customers",
      rootCause: "undefined locale passed to Intl.NumberFormat in billing/format.ts:19",
    },
    qualityScore: 79,
    coverage: 87,
    costAvoided: 11200,
    codeChanges: 34,
    impactedTests: 41,
    regressionsCaught: 3,
    testsAdded: 2,
    testsTotal: 133,
    testsPassed: 127,
    durationMs: 402_000,
  },
  {
    version: "v2.7.9",
    title: "Add SSO login",
    branch: "feat/sso-login",
    prNumber: 1221,
    status: "SUCCESS",
    flows: ["auth", "onboarding"],
    failures: ["auth.spec › SSO callback keeps return URL"],
    anomaly: "login loop for users with two active sessions",
    qualityScore: 82,
    coverage: 89,
    costAvoided: 12600,
    codeChanges: 24,
    impactedTests: 36,
    regressionsCaught: 2,
    testsAdded: 2,
    testsTotal: 138,
    testsPassed: 136,
    durationMs: 297_000,
  },
  {
    version: "v2.8.0",
    title: "Speed up product listing",
    branch: "perf/product-listing",
    prNumber: 1228,
    status: "SUCCESS",
    flows: ["catalog", "search", "cart"],
    failures: ["catalog.spec › infinite scroll loads page 3"],
    bug: {
      id: 829,
      summary: "out-of-stock badge missing after cache warm-up",
      rootCause: "stale inventory key in catalog/cache.ts:58",
    },
    qualityScore: 84,
    coverage: 91,
    costAvoided: 14900,
    codeChanges: 28,
    impactedTests: 40,
    regressionsCaught: 2,
    testsAdded: 1,
    testsTotal: 142,
    testsPassed: 140,
    durationMs: 318_000,
  },
  {
    version: "v2.8.1",
    title: "Fix checkout session handling",
    branch: "fix/checkout-session",
    prNumber: 1234,
    status: "SUCCESS",
    flows: ["checkout", "auth", "billing"],
    failures: [
      "checkout.spec › expired session blocks payment step",
      "checkout.spec › retry payment after session refresh",
      "auth.spec › refresh token rotates on resume",
    ],
    bug: {
      id: 842,
      summary: "checkout fails after session expiry",
      rootCause: "stale token in auth/refresh.ts:87",
    },
    anomaly: "repeated payment attempts · session #8f2a",
    qualityScore: 92,
    coverage: 94,
    costAvoided: 18400,
    codeChanges: 31,
    impactedTests: 47,
    regressionsCaught: 3,
    testsAdded: 2,
    testsTotal: 148,
    testsPassed: 145,
    durationMs: 296_000,
  },
];

export interface LogSeed {
  timestamp: Date;
  stream: LogStream;
  tag: LogTag;
  message: string;
}

export interface RunSeed {
  release: number;
  version: string;
  title: string;
  branch: string;
  prNumber: number;
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
  createdAt: Date;
  logs: LogSeed[];
}

const formatList = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const formatUsd = (n: number) => `$${(n / 1000).toFixed(1)}K`;

/** Génère les lignes "qasyn watch --all" d'une release. */
export function buildRunLogs(t: ReleaseTemplate, release: number, project: string, start: Date): LogSeed[] {
  let clock = start.getTime();
  const lines: LogSeed[] = [];
  const push = (tag: LogTag, message: string, stream: LogStream = "stdout", stepMs = 1000) => {
    clock += stepMs;
    lines.push({ timestamp: new Date(clock), stream, tag, message });
  };

  push("INFO", `qasyn watch --all · attached to ${project}`, "stdout", 0);
  push("DEPLOY", `New version deployed · ${t.version} detected`);
  push("TEST", `Running ${t.testsTotal} tests across ${formatList(t.flows)}`);
  push("PR", `Analyzed PR #${t.prNumber} "${t.title}" · ${t.codeChanges} code changes · ${t.impactedTests} impacted tests`, "stdout", 2000);
  for (const failure of t.failures) push("FAIL", `✗ ${failure}`, "stderr", 900);
  push("TEST", `${t.testsPassed}/${t.testsTotal} passed · ${t.testsTotal - t.testsPassed} failed · ${(t.durationMs / 60_000).toFixed(1)} min`, "stdout", 1500);
  push("PR", `Found ${t.regressionsCaught} defect${t.regressionsCaught > 1 ? "s" : ""} in PR #${t.prNumber} before merge`);
  push("TEST", `Created ${t.testsAdded} regression test case${t.testsAdded > 1 ? "s" : ""} for PR #${t.prNumber}`);
  if (t.bug) {
    push("BUG", `Reproduced bug #${t.bug.id} · ${t.bug.summary}`, "stdout", 1800);
    push("RCA", `Root cause found · ${t.bug.rootCause}`);
    push("FIX", `Attached reproduction steps, trace and suggested fix to #${t.bug.id}`);
  }
  if (t.anomaly) {
    push("WARN", `Production anomaly reproduced · ${t.anomaly}`, "stdout", 1400);
    push("TEST", "Added anomaly to regression suite · runs on every future PR");
  }
  push(
    "INFO",
    `Release Quality Report · score ${t.qualityScore}/100 · coverage ${t.coverage}% · ${formatUsd(t.costAvoided)} defect cost avoided`,
    "stdout",
    1200,
  );
  if (t.status === "FAILED") {
    push("FAIL", `Release blocked · ${t.testsTotal - t.testsPassed} failing checks need attention`, "stderr");
  } else {
    push("INFO", "Watching for changes…");
  }
  return lines;
}

const DAY_MS = 86_400_000;

/**
 * Construit l'historique complet (runs + logs).
 * @param project   libellé affiché dans le terminal, ex. "acme / storefront"
 * @param firstRelease numéro de la première release (277 pour la démo → 284)
 */
export function buildDemoRuns(project: string, firstRelease: number, now: Date = new Date()): RunSeed[] {
  const total = RELEASE_TEMPLATES.length;
  return RELEASE_TEMPLATES.map((t, index) => {
    const release = firstRelease + index;
    // Une release tous les 3 jours, la dernière il y a 12 minutes.
    const createdAt = new Date(now.getTime() - (total - 1 - index) * 3 * DAY_MS - 12 * 60_000);
    const { flows: _flows, failures: _failures, bug: _bug, anomaly, ...metrics } = t;
    return {
      ...metrics,
      release,
      anomaliesReproduced: anomaly ? 1 : 0,
      createdAt,
      logs: buildRunLogs(t, release, project, createdAt),
    };
  });
}
