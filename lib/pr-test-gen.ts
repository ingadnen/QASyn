import { callTenantAiModel } from "./model-router";
import type { PrFileDiff } from "./pr-diff";

export interface PrStep {
  action: "Navigate" | "Click" | "Enter Text" | "Verify Element" | "AI Assertion";
  target: string;
  value: string;
}

export interface PrTestDefinition {
  title: string;
  module: string;
  criticality: "critical" | "high" | "medium" | "low";
  description: string;
  testType: string;
  stepsCount: number;
  /** Concrete steps grounded in this PR's diff — never a generic site journey. */
  steps: PrStep[];
}

export interface GeneratedPrTests {
  definitions: Array<PrTestDefinition & { prefixedTitle: string }>;
  provider: string;
  modelId: string | null;
  /** "ai-model" = a configured tenant model drafted them; "calibrated" = local engine derived them from the PR diff. */
  mode: "ai-model" | "calibrated";
}

const CRITICALITIES = new Set(["critical", "high", "medium", "low"]);
const ACTIONS = new Set(["Navigate", "Click", "Enter Text", "Verify Element", "AI Assertion"]);

/** Prefix every drafted title with the PR number so re-runs can reuse/dedupe them. */
export function prCaseTitlePrefix(prNumber: number): string {
  return `PR #${prNumber} ·`;
}

function clampSteps(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? Math.round(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(3, Math.min(8, parsed));
}

/** Validates model-drafted steps; falls back to calibrated steps when unusable. */
function saneSteps(raw: unknown, fallback: PrStep[]): PrStep[] {
  if (!Array.isArray(raw)) return fallback;
  const steps = raw
    .map((step): PrStep | null => {
      if (!step || typeof step !== "object") return null;
      const record = step as Record<string, unknown>;
      const actionRaw = typeof record.action === "string" ? record.action.trim() : "";
      const action = ACTIONS.has(actionRaw) ? (actionRaw as PrStep["action"]) : null;
      const target = typeof record.target === "string" ? record.target.trim().slice(0, 240) : "";
      if (!action || target.length < 4) return null;
      return { action, target, value: typeof record.value === "string" ? record.value.slice(0, 160) : "" };
    })
    .filter((step): step is PrStep => step !== null);
  return steps.length >= 3 ? steps.slice(0, 8) : fallback;
}

/** Removes noisy diff metadata and clamps a change summary to one prompt line. */
function summarizeChange(patch: string): string {
  const lines = patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++") && !line.startsWith("+@@"))
    .slice(0, 12)
    .map((line) => line.slice(0, 160));
  return lines.join("\n") || patch.slice(0, 300);
}

function saneDefinition(
  raw: unknown,
  allowedModules: string[],
  fallbackModule: string,
  fallbackSteps: PrStep[],
): PrTestDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (title.length < 6 || title.length > 120) return null;
  const criticalityRaw = typeof record.criticality === "string" ? record.criticality.toLowerCase() : "";
  const criticality = (CRITICALITIES.has(criticalityRaw) ? criticalityRaw : "high") as PrTestDefinition["criticality"];
  const moduleRaw = typeof record.module === "string" ? record.module.trim() : "";
  const module =
    allowedModules.find((candidate) => candidate.toLowerCase() === moduleRaw.toLowerCase()) || fallbackModule;
  const testTypeRaw = typeof record.testType === "string" ? record.testType.trim() : "";
  const testType = /^(smoke|regression|functional|e2e|integration|unit|penetration|performance)$/i.test(testTypeRaw)
    ? testTypeRaw.replace(/^\w/, (c) => c.toUpperCase())
    : "Regression";
  const steps = saneSteps(record.steps, fallbackSteps);
  return {
    title,
    module,
    criticality,
    description: typeof record.description === "string" ? record.description.trim().slice(0, 400) : "",
    testType,
    stepsCount: steps.length,
    steps,
  };
}

/** Turns a source path like `src/checkout/checkout-session.ts` into "checkout session". */
function topicFromPath(path: string): string {
  const GENERIC = new Set(["src", "app", "lib", "pages", "components", "server files", "server", "backend-php", "frontend-ui"]);
  const withoutPrefix = path.replace(/^\.?\/?(src|app|lib|packages?|frontend-ui)\//, "").replace(/\.[a-zA-Z0-9]+$/, "");
  const fileName = withoutPrefix.split("/").pop() ?? withoutPrefix;
  const segments = withoutPrefix.split("/").filter(Boolean);
  // Keep path segments that add information beyond the file name (e.g.
  // "pages/Listings/ListingsStatus" → "listings status", not "listings listingsstatus").
  const extra = segments
    .slice(0, -1)
    .flatMap((segment) => segment.split(/[-_\s]+/))
    .filter((word) => word && !GENERIC.has(word.toLowerCase()) && !fileName.toLowerCase().includes(word.toLowerCase()));
  return [...extra, ...fileName.split(/(?=[A-Z])|[-_\s]+/).map((w) => w.toLowerCase())]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Calibrated fallback: derives concrete steps from the real diff — the surface
 * that changed, the behaviour the hunks touch and the regression risk — always
 * anchored on the website under test (never the PR URL).
 */
function calibratedSteps(
  topic: string,
  changedFile: string | null,
  changeSummary: string,
  siteUrl: string,
  testType: string,
): PrStep[] {
  const goTo = siteUrl || "the application under test";
  const surface = topic || "changed feature";
  const anchor = changedFile ? ` introduced by the change to ${changedFile}` : "";
  const steps: PrStep[] = [
    { action: "Navigate", target: `Navigate to ${goTo}`, value: "" },
    {
      action: "Verify Element",
      target: siteUrl
        ? `Verify that the ${surface} entry point is reachable from the home page`
        : `Verify that the ${surface} entry point is reachable`,
      value: "",
    },
  ];
  if (changeSummary) {
    steps.push({
      action: "Enter Text",
      target: `Enter representative data in the ${surface} form or input touched by the diff`,
      value: changeSummary.split("\n")[0].slice(0, 60),
    });
  }
  steps.push({ action: "Click", target: `Click through the ${surface} flow end to end`, value: "" });
  steps.push({
    action: "AI Assertion",
    target: `Verify the ${surface} behaviour matches the pre-change baseline${anchor}`,
    value: "",
  });
  if (testType !== "Smoke") {
    steps.push({
      action: "AI Assertion",
      target: `Verify no regression in adjacent flows that import or depend on ${changedFile ?? surface}`,
      value: "",
    });
    steps.push({
      action: "AI Assertion",
      target: `Verify the ${surface} journey completes with zero console errors and zero 5xx responses`,
      value: "",
    });
  }
  return steps.slice(0, 8);
}

function calibratedFallback(
  prNumber: number,
  prTitle: string,
  branch: string,
  files: string[],
  modules: string[],
  diffs: PrFileDiff[],
  siteUrl: string,
): PrTestDefinition[] {
  const moduleFor = (index: number) => modules[index % Math.max(1, modules.length)] || "Regression";
  const diffFor = (file: string) => diffs.find((diff) => diff.file === file);
  const definitions: PrTestDefinition[] = [];
  const focusFiles = [...files]
    .filter((file) => /\.(ts|tsx|js|jsx|py|go|java)$/.test(file))
    .slice(0, 3);
  for (const file of focusFiles) {
    const topic = topicFromPath(file) || file;
    const diff = diffFor(file);
    definitions.push({
      title: `Verify ${topic} behaviour after change to ${file}`,
      module: moduleFor(definitions.length),
      criticality: "high",
      description: `Drafted from the PR diff: exercises ${file} changed on branch ${branch}.`,
      testType: "Regression",
      stepsCount: 5,
      steps: calibratedSteps(topic, file, diff ? summarizeChange(diff.patch) : "", siteUrl, "Regression"),
    });
  }
  const cleanTitle = prTitle.replace(/^#\d+\s*/, "").trim();
  const topDiff = diffs[0];
  definitions.push({
    title: `Regression: ${cleanTitle || `branch ${branch}`}`,
    module: moduleFor(definitions.length),
    criticality: "high",
    description: `End-to-end regression pass anchored on the PR title across ${files.length} changed file(s).`,
    testType: "Regression",
    stepsCount: 6,
    steps: calibratedSteps(
      topicFromPath(topDiff?.file ?? files[0] ?? "") || cleanTitle || "primary feature",
      topDiff?.file ?? files[0] ?? null,
      topDiff ? summarizeChange(topDiff.patch) : "",
      siteUrl,
      "Regression",
    ),
  });
  return definitions.slice(0, 4);
}

/**
 * Drafts test cases — including their concrete steps — for ONE specific pull
 * request. When the workspace has a model configured for the "PR Review" role,
 * that model drafts the cases from the PR title, changed files and the real
 * unified diffs; otherwise the calibrated local engine derives them from the
 * diff hunks. Steps are always anchored on the website under test, never on
 * the PR URL, and never a generic site journey.
 */
export async function generatePrTests(input: {
  organisationId: string;
  prNumber: number;
  prTitle: string;
  branch: string;
  changedFiles: string[];
  modules: string[];
  diffs?: PrFileDiff[];
  /** Website under test (organisation website / environment base URL). */
  siteUrl?: string;
}): Promise<GeneratedPrTests> {
  const diffs = input.diffs ?? [];
  const siteUrl = (input.siteUrl ?? "").trim();
  const fallbackModule = input.modules[0] || "Regression";
  const titlePrefix = prCaseTitlePrefix(input.prNumber);

  const diffExcerpt = diffs
    .map((diff) => `--- ${diff.file}\n${diff.patch}`)
    .join("\n\n")
    .slice(0, 14_000);

  const system =
    "You are QASyn's PR test engineer. Draft concrete test cases for exactly one pull request, grounded in the real code changes. " +
    "For every case, author the actual step-by-step script a tester would run against the website under test (NOT the PR page): " +
    "start with a Navigate step to the site, then Click/Enter Text/Verify Element steps that exercise the changed behaviour, " +
    "and finish with AI Assertion steps verifying the changed behaviour and its regression risk. " +
    "Reply with ONLY a JSON array (no prose, no code fences) of 2 to 4 objects: " +
    '{"title": string (specific to this PR, mentions the behaviour or file under test), "module": string, ' +
    '"criticality": "critical"|"high"|"medium"|"low", "testType": "Smoke"|"Regression"|"Functional"|"E2E", ' +
    '"description": string, "steps": [{"action": "Navigate"|"Click"|"Enter Text"|"Verify Element"|"AI Assertion", ' +
    '"target": string (what to do / assert, phrased for a human tester), "value": string}]}.';

  const user = [
    `Pull request: #${input.prNumber} ${input.prTitle}`,
    `Branch: ${input.branch}`,
    `Website under test: ${siteUrl || "the application under test"}`,
    `Modules in the blast radius: ${input.modules.join(", ") || fallbackModule}`,
    "Changed files:",
    ...input.changedFiles.slice(0, 40).map((file) => `- ${file}`),
    diffExcerpt ? "Unified diff of the changes (use this to decide WHAT each step must verify):" : "",
    diffExcerpt,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callTenantAiModel({
    organisationId: input.organisationId,
    role: "PR Review",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: 1_600,
    temperature: 0.3,
  });

  if (result.ok && result.text) {
    try {
      const match = result.text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : result.text) as unknown;
      if (Array.isArray(parsed)) {
        const definitions = parsed
          .map((raw) => saneDefinition(raw, input.modules, fallbackModule, calibratedSteps("", null, "", siteUrl, "Regression")))
          .filter((def): def is PrTestDefinition => def !== null)
          .slice(0, 4);
        if (definitions.length >= 2) {
          return {
            definitions: definitions.map((def) => ({ ...def, prefixedTitle: `${titlePrefix} ${def.title}` })),
            provider: result.provider,
            modelId: result.modelId,
            mode: "ai-model",
          };
        }
      }
    } catch {
      // fall through to the calibrated fallback
    }
  }

  const definitions = calibratedFallback(
    input.prNumber,
    input.prTitle,
    input.branch,
    input.changedFiles,
    input.modules,
    diffs,
    siteUrl,
  );
  return {
    definitions: definitions.map((def) => ({ ...def, prefixedTitle: `${titlePrefix} ${def.title}` })),
    provider: "QASyn Vision AI",
    modelId: null,
    mode: "calibrated",
  };
}
