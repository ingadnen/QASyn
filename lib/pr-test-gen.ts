import { callTenantAiModel } from "./model-router";

export interface PrTestDefinition {
  title: string;
  module: string;
  criticality: "critical" | "high" | "medium" | "low";
  description: string;
  testType: string;
  stepsCount: number;
}

export interface GeneratedPrTests {
  definitions: Array<PrTestDefinition & { prefixedTitle: string }>;
  provider: string;
  modelId: string | null;
  /** "ai-model" = a configured tenant model drafted them; "calibrated" = local engine derived them from the PR diff. */
  mode: "ai-model" | "calibrated";
}

const CRITICALITIES = new Set(["critical", "high", "medium", "low"]);

/** Prefix every drafted title with the PR number so re-runs can reuse/dedupe them. */
export function prCaseTitlePrefix(prNumber: number): string {
  return `PR #${prNumber} ·`;
}

function clampSteps(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? Math.round(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(3, Math.min(8, parsed));
}

function saneDefinition(raw: unknown, allowedModules: string[], fallbackModule: string): PrTestDefinition | null {
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
  return {
    title,
    module,
    criticality,
    description: typeof record.description === "string" ? record.description.trim().slice(0, 400) : "",
    testType,
    stepsCount: clampSteps(record.stepsCount, testType === "Smoke" ? 4 : 6),
  };
}

/** Turns a source path like `src/checkout/checkout-session.ts` into "checkout session". */
function topicFromPath(path: string): string {
  const withoutPrefix = path.replace(/^\.?\/?(src|app|lib|packages?)\//, "").replace(/\.[a-zA-Z0-9]+$/, "");
  const segments = withoutPrefix.split("/").filter(Boolean).slice(-2);
  return segments
    .join(" ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function calibratedFallback(
  prNumber: number,
  prTitle: string,
  branch: string,
  files: string[],
  modules: string[],
): PrTestDefinition[] {
  const moduleFor = (index: number) => modules[index % Math.max(1, modules.length)] || "Regression";
  const definitions: PrTestDefinition[] = [];
  const focusFiles = [...files]
    .filter((file) => /\.(ts|tsx|js|jsx|py|go|java)$/.test(file))
    .slice(0, 3);
  for (const file of focusFiles) {
    const topic = topicFromPath(file) || file;
    definitions.push({
      title: `Verify ${topic} behaviour after change to ${file}`,
      module: moduleFor(definitions.length),
      criticality: "high",
      description: `Drafted from the PR diff: exercises ${file} changed on branch ${branch}.`,
      testType: "Regression",
      stepsCount: 5,
    });
  }
  const cleanTitle = prTitle.replace(/^#\d+\s*/, "").trim();
  definitions.push({
    title: `Regression: ${cleanTitle || `branch ${branch}`}`,
    module: moduleFor(definitions.length),
    criticality: "high",
    description: `End-to-end regression pass anchored on the PR title across ${files.length} changed file(s).`,
    testType: "Regression",
    stepsCount: 6,
  });
  return definitions.slice(0, 4);
}

/**
 * Drafts test cases for ONE specific pull request. When the workspace has a
 * model configured for the "PR Review" role, that model drafts the cases from
 * the PR title and changed-file list; otherwise the calibrated local engine
 * derives them from the actual changed files. Either way the cases are tied to
 * this PR — never a generic catalog.
 */
export async function generatePrTests(input: {
  organisationId: string;
  prNumber: number;
  prTitle: string;
  branch: string;
  changedFiles: string[];
  modules: string[];
}): Promise<GeneratedPrTests> {
  const fallbackModule = input.modules[0] || "Regression";
  const titlePrefix = prCaseTitlePrefix(input.prNumber);

  const system =
    "You are QASyn's PR test engineer. Draft concrete test cases for exactly one pull request, based on its title and changed files. " +
    "Reply with ONLY a JSON array (no prose, no code fences) of 2 to 4 objects: " +
    '{"title": string (specific to this PR, mentions the behaviour or file under test), "module": string, ' +
    '"criticality": "critical"|"high"|"medium"|"low", "testType": "Smoke"|"Regression"|"Functional"|"E2E", ' +
    '"stepsCount": number 3-8, "description": string}.';
  const user = [
    `Pull request: #${input.prNumber} ${input.prTitle}`,
    `Branch: ${input.branch}`,
    `Modules in the blast radius: ${input.modules.join(", ") || fallbackModule}`,
    "Changed files:",
    ...input.changedFiles.slice(0, 40).map((file) => `- ${file}`),
  ].join("\n");

  const result = await callTenantAiModel({
    organisationId: input.organisationId,
    role: "PR Review",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: 900,
    temperature: 0.3,
  });

  if (result.ok && result.text) {
    try {
      const match = result.text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : result.text) as unknown;
      if (Array.isArray(parsed)) {
        const definitions = parsed
          .map((raw) => saneDefinition(raw, input.modules, fallbackModule))
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

  const definitions = calibratedFallback(input.prNumber, input.prTitle, input.branch, input.changedFiles, input.modules);
  return {
    definitions: definitions.map((def) => ({ ...def, prefixedTitle: `${titlePrefix} ${def.title}` })),
    provider: "QASyn Vision AI",
    modelId: null,
    mode: "calibrated",
  };
}
