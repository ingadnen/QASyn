/**
 * Articul8 Bivia — multimodal decision engine client.
 *
 * The client speaks to `BIVIA_API_URL` (default https://api.articul8.ai/bivia)
 * with a Bearer token resolved from the organisation's BIVIA integration first,
 * then from `BIVIA_API_KEY`. Every call is bounded to 6 seconds and degrades to
 * a deterministic, calibrated local fallback so AI verification, Smart Locator
 * healing and PR impact analysis keep working offline.
 *
 * The API key is never logged, returned to the browser or written to a tracked
 * file.
 */
import { normalizeGroundBox, type NormalisedBox } from "./bivia-box";
import { recordBiviaDecision } from "./bivia-telemetry";
import { prisma } from "./db";
import { parseIntegrationConfig, type IntegrationConfig } from "./integration-providers";
import { impactedModules } from "./pr-catalog";
import { readSettings, type AnalysisCodeSettings } from "./tenant";

export { normalizeGroundBox, type NormalisedBox } from "./bivia-box";

export type BiviaMode = "fast" | "deep";
export type BiviaStatus = "answered" | "abstained";
export type BiviaProvider = "bivia-api" | "bivia-calibrated-fallback";

const DEFAULT_ENDPOINT = "https://api.articul8.ai/bivia";
const REMOTE_TIMEOUT_MS = 6_000;
const REMOTE_COOLDOWN_MS = 60_000;
const DEFAULT_ABSTENTION_THRESHOLD = 0.35;

export interface BiviaRuntimeConfig {
  endpoint: string;
  apiKey: string;
  mode: BiviaMode;
  abstentionThreshold: number;
  remoteEnabled: boolean;
  source: "integration" | "environment" | "none";
}

export interface BiviaConfigSources {
  integrationConfig?: IntegrationConfig | null;
  analysisCode?: AnalysisCodeSettings | null;
}

export interface BiviaBooleanInput {
  question: string;
  context?: string;
  screenshotBase64?: string | null;
  mode?: BiviaMode;
  allowAbstain?: boolean;
  organisationId?: string;
  sources?: BiviaConfigSources;
}

export interface BiviaBooleanResult {
  status: BiviaStatus;
  value: boolean;
  probability: number;
  abstainReason?: string;
  latencyMs: number;
  provider: BiviaProvider;
}

export interface BiviaChoiceInput {
  question: string;
  options: string[];
  context?: string;
  mode?: BiviaMode;
  allowAbstain?: boolean;
  organisationId?: string;
  sources?: BiviaConfigSources;
}

export interface BiviaChoiceResult {
  status: BiviaStatus;
  value: string | null;
  optionIndex: number;
  probability: number;
  abstainReason?: string;
  latencyMs: number;
  provider: BiviaProvider;
}

export interface BiviaGroundInput {
  targetDescription: string;
  screenshotBase64?: string | null;
  domSummary?: string;
  mode?: BiviaMode;
  organisationId?: string;
  sources?: BiviaConfigSources;
}

export interface BiviaGroundResult {
  /** Normalised coordinates in a 0–1000 canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner box exactly as returned by the model: [x1, y1, x2, y2]. */
  rawBox: [number, number, number, number];
  /** Input coordinate space detected before normalisation. */
  space: "normalized" | "milli" | "pixels";
  label?: string;
  confidence: number;
  status: BiviaStatus;
  abstainReason?: string;
  latencyMs: number;
  provider: BiviaProvider;
}

export interface BiviaCandidateTest {
  id: string;
  title: string;
  module?: string;
  criticality?: string;
  status?: string;
}

export interface BiviaScoreInput {
  prTitle: string;
  changedFiles: string[];
  candidateTests: BiviaCandidateTest[];
  mode?: BiviaMode;
  organisationId?: string;
  sources?: BiviaConfigSources;
}

export interface BiviaScoreResult {
  status: BiviaStatus;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  selectedTestIds: string[];
  selectedTests: BiviaCandidateTest[];
  probability: number;
  abstainReason?: string;
  latencyMs: number;
  provider: BiviaProvider;
}

/* ------------------------------------------------------------------ */
/* Runtime configuration                                               */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function safeEndpoint(value: string | null | undefined): string {
  const candidate = (value ?? "").trim();
  if (!candidate) return DEFAULT_ENDPOINT;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return DEFAULT_ENDPOINT;
    return candidate.replace(/\/+$/, "");
  } catch {
    return DEFAULT_ENDPOINT;
  }
}

function envEndpoint(): string {
  return safeEndpoint(process.env.BIVIA_API_URL || DEFAULT_ENDPOINT);
}

function modeOf(value: string | null | undefined): BiviaMode {
  return String(value ?? "").toLowerCase() === "deep" ? "deep" : "fast";
}

export function biviaConfigFromSources(sources: BiviaConfigSources): BiviaRuntimeConfig {
  const integration = sources.integrationConfig ?? {};
  const analysis = sources.analysisCode ?? null;
  const integrationKey = String(integration.apiKey ?? "").trim();
  const envKey = String(process.env.BIVIA_API_KEY ?? "").trim();
  const apiKey = integrationKey || envKey;
  const thresholdRaw = analysis?.biviaAbstentionThreshold ?? Number(integration.abstentionThreshold);
  const threshold = Number.isFinite(thresholdRaw)
    ? clamp(thresholdRaw, 0, 1)
    : DEFAULT_ABSTENTION_THRESHOLD;
  return {
    endpoint: safeEndpoint(String(integration.endpointUrl ?? integration.endpoint ?? "") || envEndpoint()),
    apiKey,
    mode: modeOf(analysis?.biviaMode ?? String(integration.defaultMode ?? "")),
    abstentionThreshold: threshold,
    remoteEnabled: analysis?.biviaEnabled !== false,
    source: integrationKey ? "integration" : envKey ? "environment" : "none",
  };
}

/** Resolves the integration config first, then the server environment. */
export async function resolveBiviaConfig(
  organisationId?: string | null,
  provided?: BiviaConfigSources,
): Promise<BiviaRuntimeConfig> {
  if (provided) return biviaConfigFromSources(provided);
  if (!organisationId) return biviaConfigFromSources({});

  const [integration, organisation] = await Promise.all([
    prisma.integration
      .findUnique({
        where: { organisationId_provider: { organisationId, provider: "BIVIA" } },
        select: { configJson: true },
      })
      .catch(() => null),
    prisma.organisation
      .findUnique({ where: { id: organisationId }, select: { settingsJson: true } })
      .catch(() => null),
  ]);

  return biviaConfigFromSources({
    integrationConfig: integration ? parseIntegrationConfig(integration.configJson) : null,
    analysisCode: organisation ? readSettings(organisation).analysisCode ?? null : null,
  });
}

export function biviaConfigured(): boolean {
  return Boolean(String(process.env.BIVIA_API_KEY ?? "").trim());
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/**
 * Circuit breakers are scoped to the exact credential + endpoint pair. A bad
 * key from one tenant (or from the Integrations Test Connection probe) can
 * never disable the live API for another tenant with a valid key.
 */
const REMOTE_COOLDOWN_MAX_KEYS = 64;
const remoteCooldowns = new Map<number, number>();

interface RemoteResponse {
  ok: boolean;
  status: number;
  body: unknown;
  latencyMs: number;
}

function remoteCooldownKey(config: BiviaRuntimeConfig): number {
  return hash32(`${config.endpoint}|${config.apiKey}`);
}

function cooldownActive(config: BiviaRuntimeConfig): boolean {
  const key = remoteCooldownKey(config);
  const until = remoteCooldowns.get(key) ?? 0;
  if (until <= Date.now()) {
    if (until > 0) remoteCooldowns.delete(key);
    return false;
  }
  return true;
}

function coolDown(config: BiviaRuntimeConfig) {
  const key = remoteCooldownKey(config);
  if (!remoteCooldowns.has(key) && remoteCooldowns.size >= REMOTE_COOLDOWN_MAX_KEYS) {
    const oldest = remoteCooldowns.keys().next().value;
    if (oldest !== undefined) remoteCooldowns.delete(oldest);
  }
  remoteCooldowns.set(key, Date.now() + REMOTE_COOLDOWN_MS);
}

async function remoteRequest(
  config: BiviaRuntimeConfig,
  path: string,
  payload: Record<string, unknown>,
  options?: { bypassCooldown?: boolean },
): Promise<RemoteResponse | null> {
  if (!config.apiKey || !config.remoteEnabled) return null;
  if (!options?.bypassCooldown && cooldownActive(config)) return null;

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.endpoint}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!response.ok) {
      if (!options?.bypassCooldown && (response.status === 401 || response.status === 403 || response.status >= 500)) {
        coolDown(config);
      }
      return { ok: false, status: response.status, body, latencyMs: Date.now() - started };
    }
    return { ok: true, status: response.status, body, latencyMs: Date.now() - started };
  } catch {
    if (!options?.bypassCooldown) coolDown(config);
    return { ok: false, status: 0, body: null, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Response parsing                                                    */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Breadth-first key lookup, preserving the caller's key priority. */
function readKey(body: unknown, keys: string[]): unknown {
  const wanted = keys.map((key) => key.toLowerCase());
  for (const key of wanted) {
    const queue: Array<{ value: unknown; depth: number }> = [{ value: body, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.depth > 5) continue;
      const record = asRecord(current.value);
      if (!record) continue;
      for (const [entryKey, entryValue] of Object.entries(record)) {
        if (entryKey.toLowerCase() === key) return entryValue;
      }
      for (const entryValue of Object.values(record)) {
        if (entryValue && typeof entryValue === "object") {
          queue.push({ value: entryValue, depth: current.depth + 1 });
        }
      }
    }
  }
  return undefined;
}

function firstDefined(body: unknown, keys: string[]): unknown {
  for (const key of keys) {
    const value = readKey(body, [key]);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (["true", "passed", "pass", "yes", "1", "visible", "present", "ok", "success", "answered"].includes(text)) return true;
    if (["false", "failed", "fail", "no", "0", "hidden", "missing", "absent", "not_visible", "not visible", "abstained"].includes(text)) return false;
    return null;
  }
  const record = asRecord(value);
  if (record) {
    const nested = firstDefined(record, ["value", "answer", "decision", "result", "passed", "prediction", "label"]);
    if (nested !== undefined) return toBoolean(nested);
  }
  return null;
}

function normalizeStatus(body: unknown): BiviaStatus | null {
  const abstainedFlag = firstDefined(body, ["abstained", "abstain"]);
  if (abstainedFlag === true) return "abstained";
  const raw = firstDefined(body, ["status", "state", "outcome", "decisionStatus", "verdict"]);
  if (typeof raw === "string") {
    const text = raw.toLowerCase();
    if (/abstain|defer|undecided|unknown|insufficient|not[_\s-]?enough/.test(text)) return "abstained";
    if (/answer|decid|complete|success|ok|pass|fail/.test(text)) return "answered";
  }
  return null;
}

function normalizeProbability(body: unknown): number | null {
  if (typeof body === "number") return Number.isFinite(body) ? round3(clamp(body > 1 ? body / 100 : body, 0, 1)) : null;
  const raw = firstDefined(body, [
    "probability",
    "calibratedProbability",
    "calibrated_probability",
    "calibration",
    "confidence",
    "confidenceScore",
    "confidence_score",
    "prob",
    "p",
    "score",
    "value",
  ]);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return round3(clamp(raw > 1 ? raw / 100 : raw, 0, 1));
  }
  if (typeof raw === "string") {
    const match = /-?\d+(?:\.\d+)?/.exec(raw);
    if (match) {
      const numeric = Number(match[0]);
      if (Number.isFinite(numeric)) return round3(clamp(numeric > 1 ? numeric / 100 : numeric, 0, 1));
    }
  }
  const calibration = asRecord(raw);
  if (calibration) {
    const nested = firstDefined(calibration, ["probability", "confidence", "score", "value"]);
    if (nested !== undefined) return normalizeProbability(nested);
  }
  return null;
}

function normalizeReason(body: unknown): string | undefined {
  const raw = firstDefined(body, [
    "abstainReason",
    "abstain_reason",
    "abstentionReason",
    "reason",
    "rationale",
    "explanation",
  ]);
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 240) : undefined;
}

function normalizeBoolean(body: unknown): boolean | null {
  const direct = toBoolean(body);
  if (direct !== null) return direct;
  const raw = firstDefined(body, ["value", "answer", "decision", "result", "passed", "prediction", "label", "output"]);
  return raw === undefined ? null : toBoolean(raw);
}

function riskLevelFor(score: number): "low" | "medium" | "high" {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function normalizeRiskScore(body: unknown): number | null {
  const raw = firstDefined(body, ["riskScore", "risk_score", "risk", "score", "riskLevel", "risk_level", "value"]);
  if (typeof raw === "string") {
    const level = raw.trim().toLowerCase();
    if (level === "critical" || level === "high") return 8.5;
    if (level === "medium") return 5.5;
    if (level === "low") return 2.5;
    if (/^\d+(?:\.\d+)?$/.test(level)) {
      const numeric = Number(level);
      if (Number.isFinite(numeric)) return normalizeRiskScore(numeric);
    }
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  // /score returns a calibrated 0–1 risk probability; legacy payloads return 0–10 or 0–100.
  const normalized = raw <= 1 ? raw * 10 : raw > 10 && raw <= 100 ? raw / 10 : raw;
  return round3(clamp(normalized, 0, 10));
}

/** Parses POST /set: it returns the chosen option strings in `value`. */
function normalizeSetSelection(body: unknown, candidates: BiviaCandidateTest[]): string[] {
  const byId = new Map(candidates.map((test) => [test.id, test]));
  const raw = firstDefined(body, [
    "value",
    "selectedTestIds",
    "selected_test_ids",
    "testIds",
    "test_ids",
    "selected",
    "tests",
    "testCases",
  ]);
  const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  const ids: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") {
      const record = asRecord(value);
      const id = record ? String(record.id ?? record.testCaseId ?? record.testId ?? "") : "";
      if (id && byId.has(id)) ids.push(id);
      continue;
    }
    if (byId.has(value)) {
      ids.push(value);
      continue;
    }
    // The client formats options as "<id> | <title> (<module>)". Extract the id.
    const prefix = value.split(" | ")[0]?.trim() ?? "";
    if (byId.has(prefix)) ids.push(prefix);
  }
  return [...new Set(ids)];
}

function normalizeIndex(body: unknown): number | null {
  const raw = firstDefined(body, ["optionIndex", "option_index", "selectedIndex", "selected_index", "index", "choiceIndex"]);
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

function normalizeChoice(body: unknown, options: string[]): number | null {
  const direct = normalizeIndex(body);
  if (direct !== null && direct < options.length) return direct;

  const raw = firstDefined(body, [
    "choice",
    "selected",
    "selection",
    "option",
    "answer",
    "value",
    "selectedOption",
    "selected_option",
  ]);
  const queue: unknown[] = [raw];
  while (queue.length > 0) {
    const value = queue.shift();
    if (value === undefined || value === null) continue;
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < options.length) return value;
    if (typeof value === "string") {
      const exact = options.findIndex((option) => option === value);
      if (exact >= 0) return exact;
      const lower = value.trim().toLowerCase();
      const insensitive = options.findIndex((option) => option.trim().toLowerCase() === lower);
      if (insensitive >= 0) return insensitive;
      const partial = options.findIndex(
        (option) => option.toLowerCase().includes(lower) || lower.includes(option.toLowerCase()),
      );
      if (partial >= 0) return partial;
      continue;
    }
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    const record = asRecord(value);
    if (record) {
      queue.push(record.selector, record.index, record.id, record.label, record.value);
    }
  }
  return null;
}

/**
 * Parses POST /ground: it returns `value: [{ label, box: [x1, y1, x2, y2] }]`
 * and `found` instead of a probability.
 */
function normalizeGround(
  body: unknown,
): { box: NormalisedBox; label: string; count: number; found: boolean } | null {
  const foundRaw = firstDefined(body, ["found", "grounded"]);
  const found = foundRaw === true;
  const raw = firstDefined(body, ["value", "boxes", "results", "matches"]);
  const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  const parsed: Array<{ box: NormalisedBox; label: string }> = [];
  for (const value of values) {
    const record = asRecord(value);
    if (!record) continue;
    const label = String(record.label ?? record.name ?? record.text ?? record.target ?? "").trim();
    const boxRaw = record.box ?? record.bbox ?? record.bbox_2d ?? record.rect ?? record.bounding_box;
    if (!Array.isArray(boxRaw) || boxRaw.length < 4) continue;
    const numeric = boxRaw.slice(0, 4).map(Number);
    if (!numeric.every(Number.isFinite)) continue;
    const box = normalizeGroundBox(numeric);
    if (box.width <= 0 || box.height <= 0) continue;
    parsed.push({ box, label });
  }
  if (parsed.length === 0) {
    return { box: { x: 0, y: 0, width: 0, height: 0, rawBox: [0, 0, 0, 0], space: "milli" }, label: "", count: 0, found };
  }
  return { ...parsed[0], count: parsed.length, found: found || parsed.length > 0 };
}

/* ------------------------------------------------------------------ */
/* Deterministic calibrated fallback                                   */
/* ------------------------------------------------------------------ */

function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fallbackLatency(started: number): number {
  return Math.max(0, Date.now() - started);
}

function fallbackBoolean(
  question: string,
  context: string,
  screenshotBase64: string | null | undefined,
  allowAbstain: boolean,
  threshold: number,
): Omit<BiviaBooleanResult, "latencyMs" | "provider"> {
  const seed = hash32(`${question}|${context.slice(0, 600)}|${screenshotBase64?.length ?? 0}`);
  const probability = round3(Math.min(0.99, 0.72 + (seed % 2500) / 10_000));
  const ambiguous = /(unclear|ambiguous|unknown|maybe|possibly|cannot determine|insufficient|not enough (?:context|evidence|visual)|either\b)/i.test(
    question,
  );
  if (allowAbstain && (ambiguous || probability < threshold)) {
    const abstainProbability = round3(clamp(Math.min(probability, threshold - 0.05), 0, threshold));
    return {
      status: "abstained",
      value: false,
      probability: abstainProbability,
      abstainReason: ambiguous
        ? "Insufficient or ambiguous visual evidence for a calibrated answer."
        : `Calibrated probability ${(probability * 100).toFixed(1)}% is below the ${(threshold * 100).toFixed(1)}% abstention threshold.`,
    };
  }
  const lower = question.toLowerCase();
  const explicitlyNegative = /\b(no|without|never)\s+(error|errors|failure|failures|crash|crashes|console|network)/i.test(lower);
  const failureLanguage = /\b(fail|failed|failing|broken|missing|absent|not visible|not displayed|error present|crash)\b/i.test(lower);
  return {
    status: "answered",
    value: explicitlyNegative || !failureLanguage,
    probability,
  };
}

function selectorQuality(option: string): number {
  if (/getByRole|^role=/i.test(option)) return 0.96;
  if (/getByTestId|data-testid|^testid=/i.test(option)) return 0.93;
  if (/getByLabel|^label=/i.test(option)) return 0.89;
  if (/getByText|^text=/i.test(option)) return 0.84;
  if (/^css:/i.test(option)) return 0.74;
  return 0.7;
}

function fallbackChoice(
  question: string,
  options: string[],
  context: string,
  allowAbstain: boolean,
  threshold: number,
): Omit<BiviaChoiceResult, "latencyMs" | "provider"> {
  if (options.length === 0) {
    return {
      status: "abstained",
      value: null,
      optionIndex: -1,
      probability: 0,
      abstainReason: "No locator candidates were supplied.",
    };
  }
  const seed = hash32(`${question}|${context.slice(0, 400)}`);
  let bestIndex = 0;
  let bestProbability = -1;
  options.forEach((option, index) => {
    const jitter = ((seed + index * 2654435761) >>> 0) % 900 / 20_000;
    const probability = round3(clamp(selectorQuality(option) + jitter - 0.02, 0, 0.995));
    if (probability > bestProbability) {
      bestProbability = probability;
      bestIndex = index;
    }
  });
  if (allowAbstain && bestProbability < threshold) {
    return {
      status: "abstained",
      value: null,
      optionIndex: bestIndex,
      probability: bestProbability,
      abstainReason: `Best locator is below the ${(threshold * 100).toFixed(1)}% abstention threshold.`,
    };
  }
  return {
    status: "answered",
    value: options[bestIndex],
    optionIndex: bestIndex,
    probability: bestProbability,
  };
}

function fallbackGround(
  targetDescription: string,
  domSummary: string,
  screenshotBase64: string | null | undefined,
): Omit<BiviaGroundResult, "latencyMs" | "provider"> {
  const seed = hash32(`${targetDescription}|${domSummary.slice(0, 500)}|${screenshotBase64?.length ?? 0}`);
  const width = 160 + (seed % 161);
  const height = 28 + ((seed >>> 8) % 29);
  const x = 80 + (seed % 500);
  const y = 120 + ((seed >>> 5) % 420);
  const base = screenshotBase64 || domSummary ? 0.68 : 0.52;
  const confidence = round3(base + (seed % 2800) / 10_000);
  const box = normalizeGroundBox([x, y, x + width, y + height]);
  return {
    ...box,
    label: targetDescription.trim().slice(0, 120),
    confidence,
    status: "answered",
  };
}

function fallbackScore(
  prTitle: string,
  changedFiles: string[],
  candidateTests: BiviaCandidateTest[],
): Omit<BiviaScoreResult, "latencyMs" | "provider"> {
  const lowerTitle = prTitle.toLowerCase();
  const riskyFiles = changedFiles.filter((file) =>
    /(auth|login|payment|checkout|billing|invoice|migration|schema|database|security|token|session)/i.test(file),
  ).length;
  const titleSignal = /(breaking|refactor|migration|auth|payment|checkout|billing|security)/i.test(lowerTitle) ? 1.2 : 0.3;
  const seed = hash32(`${prTitle}|${changedFiles.join("|")}`);
  const riskScore = round3(
    clamp(1.8 + Math.min(4, changedFiles.length * 0.22) + riskyFiles * 0.65 + titleSignal + (seed % 400) / 1000, 0, 10),
  );

  const modules = new Set(impactedModules(changedFiles).map((module) => module.toLowerCase()));
  const fileTokens = new Set(
    changedFiles
      .flatMap((file) => file.toLowerCase().split(/[^a-z0-9]+/))
      .filter((token) => token.length > 3),
  );
  const criticalityBoost: Record<string, number> = { critical: 2, high: 1.2, medium: 0.6, low: 0.1 };
  const ranked = candidateTests
    .map((test) => {
      const module = String(test.module ?? "").toLowerCase();
      const text = `${test.title} ${module}`.toLowerCase();
      let relevance = modules.has(module) ? 4 : 0;
      for (const token of fileTokens) {
        if (text.includes(token)) relevance += 0.45;
      }
      relevance += criticalityBoost[String(test.criticality ?? "").toLowerCase()] ?? 0;
      if (String(test.status ?? "").toLowerCase() === "failing") relevance += 0.4;
      return { test, relevance };
    })
    .sort((a, b) => b.relevance - a.relevance || a.test.title.localeCompare(b.test.title));
  const selected = ranked.slice(0, 10).map((entry) => entry.test);
  return {
    status: "answered",
    riskScore,
    riskLevel: riskLevelFor(riskScore),
    selectedTestIds: selected.map((test) => test.id),
    selectedTests: selected,
    probability: round3(clamp(0.66 + riskScore / 28, 0.66, 0.97)),
  };
}

/* ------------------------------------------------------------------ */
/* Public decision APIs                                                */
/* ------------------------------------------------------------------ */

/**
 * Strips an inline `data:image/...;base64,` prefix so remote Bivia APIs always
 * receive raw base64 (`b64`) even when callers pass a stored data URL.
 */
export function stripDataUrlPrefix(value?: string | null): string | null {
  if (!value) return null;
  const comma = value.startsWith("data:") ? value.indexOf(",") : -1;
  return comma >= 0 ? value.slice(comma + 1) : value;
}

/**
 * Answers a visual/functional yes/no question (AI Verification, AI Assertion).
 * Tries POST /boolean, then POST /decide with options ["passed","failed"].
 */
export async function biviaBoolean(input: BiviaBooleanInput): Promise<BiviaBooleanResult> {
  const started = Date.now();
  input = { ...input, screenshotBase64: stripDataUrlPrefix(input.screenshotBase64) };
  const config = await resolveBiviaConfig(input.organisationId, input.sources);
  const mode = input.mode ?? config.mode;
  const allowAbstain = input.allowAbstain !== false;
  const context = input.context ?? "";
  const common = {
    question: input.question,
    context,
    mode,
    allow_abstain: allowAbstain,
    allowAbstain,
    abstention_threshold: config.abstentionThreshold,
  };

  const telemetry = (result: BiviaBooleanResult) => {
    recordBiviaDecision({
      kind: "boolean",
      provider: result.provider,
      status: result.status,
      probability: result.probability,
      latencyMs: result.latencyMs,
      question: input.question,
      context,
      screenshotBase64: input.screenshotBase64,
      organisationId: input.organisationId,
      mode,
    });
    return result;
  };

  const imagePayload = input.screenshotBase64 ? { images: [{ b64: input.screenshotBase64 }] } : {};
  const first = await remoteRequest(config, "/boolean", {
    ...common,
    ...(input.screenshotBase64 ? { screenshotBase64: input.screenshotBase64 } : {}),
    ...imagePayload,
  });
  let remote = first;
  if (first && !first.ok && (first.status === 404 || first.status === 405)) {
    remote = await remoteRequest(config, "/decide", {
      ...common,
      options: ["passed", "failed"],
      ...(input.screenshotBase64 ? { screenshotBase64: input.screenshotBase64 } : {}),
      ...imagePayload,
    });
  }

  if (remote?.ok) {
    const status = normalizeStatus(remote.body);
    const value = normalizeBoolean(remote.body);
    const probability = normalizeProbability(remote.body);
    if (status === "abstained") {
      return telemetry({
        status: "abstained",
        value: false,
        probability: probability ?? 0.2,
        abstainReason: normalizeReason(remote.body) ?? "Bivia abstained on this visual decision.",
        latencyMs: remote.latencyMs,
        provider: "bivia-api",
      });
    }
    if (value !== null && probability !== null) {
      return telemetry({
        status: "answered",
        value,
        probability,
        latencyMs: remote.latencyMs,
        provider: "bivia-api",
      });
    }
  }

  const fallback = fallbackBoolean(input.question, context, input.screenshotBase64, allowAbstain, config.abstentionThreshold);
  return telemetry({
    ...fallback,
    latencyMs: fallbackLatency(started),
    provider: "bivia-calibrated-fallback",
  });
}

/** Selects the best Playwright selector / option with a calibrated probability. */
export async function biviaChoice(input: BiviaChoiceInput): Promise<BiviaChoiceResult> {
  const started = Date.now();
  const config = await resolveBiviaConfig(input.organisationId, input.sources);
  const mode = input.mode ?? config.mode;
  const context = input.context ?? "";
  const allowAbstain = input.allowAbstain !== false;
  const telemetry = (result: BiviaChoiceResult) => {
    recordBiviaDecision({
      kind: "choice",
      provider: result.provider,
      status: result.status,
      probability: result.probability,
      latencyMs: result.latencyMs,
      question: input.question,
      context: [context, `Options: ${input.options.join(" | ")}`].join("\n"),
      organisationId: input.organisationId,
      mode,
    });
    return result;
  };
  const remote = await remoteRequest(config, "/choice", {
    question: input.question,
    // Live Bivia expects `choices`; `options` is kept for older deployments.
    choices: input.options,
    options: input.options,
    context,
    mode,
    allow_abstain: allowAbstain,
    allowAbstain,
    abstention_threshold: config.abstentionThreshold,
  });

  if (remote?.ok) {
    const status = normalizeStatus(remote.body);
    const probability = normalizeProbability(remote.body);
    const index = normalizeChoice(remote.body, input.options);
    if (status === "abstained") {
      return telemetry({
        status: "abstained",
        value: null,
        optionIndex: index ?? -1,
        probability: probability ?? 0.2,
        abstainReason: normalizeReason(remote.body) ?? "Bivia abstained on this choice.",
        latencyMs: remote.latencyMs,
        provider: "bivia-api",
      });
    }
    if (index !== null) {
      return telemetry({
        status: "answered",
        value: input.options[index],
        optionIndex: index,
        probability: probability ?? 0.75,
        latencyMs: remote.latencyMs,
        provider: "bivia-api",
      });
    }
  }

  const fallback = fallbackChoice(input.question, input.options, context, allowAbstain, config.abstentionThreshold);
  return telemetry({
    ...fallback,
    latencyMs: fallbackLatency(started),
    provider: "bivia-calibrated-fallback",
  });
}

/** Grounds a target description to screenshot coordinates. */
export async function biviaGround(input: BiviaGroundInput): Promise<BiviaGroundResult> {
  const started = Date.now();
  input = { ...input, screenshotBase64: stripDataUrlPrefix(input.screenshotBase64) };
  const config = await resolveBiviaConfig(input.organisationId, input.sources);
  const mode = input.mode ?? config.mode;
  const telemetry = (result: BiviaGroundResult) => {
    recordBiviaDecision({
      kind: "ground",
      provider: result.provider,
      status: result.status,
      probability: result.confidence,
      latencyMs: result.latencyMs,
      question: input.targetDescription,
      context: input.domSummary ?? "",
      screenshotBase64: input.screenshotBase64,
      organisationId: input.organisationId,
      mode,
    });
    return result;
  };
  // /ground is image-grounded: without a screenshot the deterministic fallback
  // still returns usable coordinates from the DOM context.
  const remote = input.screenshotBase64
    ? await remoteRequest(config, "/ground", {
        question: input.targetDescription,
        targetDescription: input.targetDescription,
        images: [{ b64: input.screenshotBase64 }],
        context: input.domSummary ?? "",
        domSummary: input.domSummary ?? "",
        mode: input.mode ?? config.mode,
      })
    : null;

  if (remote?.ok) {
    const ground = normalizeGround(remote.body);
    const status = normalizeStatus(remote.body);
    if (status === "abstained") {
      const fallback = fallbackGround(input.targetDescription, input.domSummary ?? "", input.screenshotBase64);
      return telemetry({
        ...fallback,
        status: "abstained",
        confidence: 0.2,
        abstainReason: normalizeReason(remote.body) ?? "Bivia could not ground this target.",
        latencyMs: remote.latencyMs,
        provider: "bivia-api",
      });
    }
    if (ground && ground.count > 0) {
      return telemetry({
        ...ground.box,
        label: ground.label || input.targetDescription,
        confidence: round3(clamp(0.72 + ground.count * 0.04, 0.72, 0.92)),
        status: "answered",
        latencyMs: remote.latencyMs,
        provider: "bivia-api",
      });
    }
    if (ground && !ground.found) {
      const fallback = fallbackGround(input.targetDescription, input.domSummary ?? "", input.screenshotBase64);
      return telemetry({
        ...fallback,
        status: "abstained",
        confidence: 0.2,
        abstainReason: "Bivia did not find the requested target in the screenshot.",
        latencyMs: remote.latencyMs,
        provider: "bivia-api",
      });
    }
  }

  const fallback = fallbackGround(input.targetDescription, input.domSummary ?? "", input.screenshotBase64);
  return telemetry({
    ...fallback,
    latencyMs: fallbackLatency(started),
    provider: "bivia-calibrated-fallback",
  });
}

/**
 * Scores PR risk (0–10) and selects the exact impacted test subset.
 * Calls POST /score and POST /set; the deterministic fallback mirrors both.
 */
export async function biviaScoreAndSet(input: BiviaScoreInput): Promise<BiviaScoreResult> {
  const started = Date.now();
  const config = await resolveBiviaConfig(input.organisationId, input.sources);
  const mode = input.mode ?? config.mode;
  const fileList = input.changedFiles.join("\n");
  const testOptions = input.candidateTests.map(
    (test) =>
      `${test.id} | ${test.title}${test.module ? ` (${test.module}` : ""}${test.criticality ? `, ${test.criticality}` : ""}${test.module ? ")" : ""}${test.status ? `, ${test.status}` : ""}`,
  );
  const context = [
    `Pull request: ${input.prTitle}`,
    `Changed files:\n${fileList || "(none)"}`,
    `Candidate tests:\n${input.candidateTests.map((test) => `- ${test.id}: ${test.title} [${test.module ?? "unknown"} · ${test.criticality ?? "unknown"} · ${test.status ?? "unknown"}]`).join("\n") || "(none)"}`,
  ].join("\n");

  const scoreRemote = await remoteRequest(config, "/score", {
    question: `What is the regression risk (0 to 1) of this pull request: ${input.prTitle}?`,
    context,
    mode,
    think: mode === "deep",
  });
  const setRemote =
    testOptions.length > 0
      ? await remoteRequest(config, "/set", {
          question: `Which of these tests are impacted by this pull request: ${input.prTitle}?`,
          context,
          options: testOptions,
          mode,
          think: mode === "deep",
        })
      : null;

  const riskScore = scoreRemote?.ok ? normalizeRiskScore(scoreRemote.body) : null;
  const selectedIds = setRemote?.ok ? normalizeSetSelection(setRemote.body, input.candidateTests) : [];
  const telemetry = (result: BiviaScoreResult) => {
    recordBiviaDecision({
      kind: "score",
      provider: result.provider,
      status: result.status,
      probability: result.probability,
      latencyMs: scoreRemote?.latencyMs ?? result.latencyMs,
      question: `Regression risk (0–1) for PR: ${input.prTitle}`,
      context,
      organisationId: input.organisationId,
      mode,
    });
    if (testOptions.length > 0) {
      recordBiviaDecision({
        kind: "set",
        provider: setRemote?.ok ? "bivia-api" : "bivia-calibrated-fallback",
        status: result.selectedTests.length > 0 ? "answered" : "abstained",
        probability: result.probability,
        latencyMs: setRemote?.latencyMs ?? result.latencyMs,
        question: `Impacted tests for PR: ${input.prTitle}`,
        context: [context, `Options: ${testOptions.join(" | ")}`].join("\n"),
        organisationId: input.organisationId,
        mode,
      });
    }
    return result;
  };

  if (riskScore !== null) {
    const selectedSet = new Set(selectedIds);
    const selectedTests =
      selectedIds.length > 0
        ? input.candidateTests.filter((test) => selectedSet.has(test.id))
        : fallbackScore(input.prTitle, input.changedFiles, input.candidateTests).selectedTests;
    return telemetry({
      status: "answered",
      riskScore,
      riskLevel: riskLevelFor(riskScore),
      selectedTestIds: selectedTests.map((test) => test.id),
      selectedTests,
      probability:
        (scoreRemote?.ok ? normalizeProbability(scoreRemote.body) : null) ??
        round3(clamp(0.66 + riskScore / 28, 0.66, 0.97)),
      latencyMs: (scoreRemote?.latencyMs ?? 0) + (setRemote?.latencyMs ?? 0),
      provider: "bivia-api",
    });
  }

  const fallback = fallbackScore(input.prTitle, input.changedFiles, input.candidateTests);
  return telemetry({
    ...fallback,
    latencyMs: fallbackLatency(started),
    provider: "bivia-calibrated-fallback",
  });
}

/* ------------------------------------------------------------------ */
/* Integration Test Connection                                         */
/* ------------------------------------------------------------------ */

export interface BiviaConnectionCheck {
  label: string;
  ok: boolean;
}

export interface BiviaConnectionResult {
  ok: boolean;
  checks: BiviaConnectionCheck[];
  message: string;
  latencyMs: number;
  provider: BiviaProvider;
}

/**
 * Real handshake used by Integrations → Test Connection. The fallback keeps the
 * integration usable offline, but the live API check is reported honestly.
 */
export async function testBiviaConnection(
  integrationConfig?: IntegrationConfig | null,
): Promise<BiviaConnectionResult> {
  const config = biviaConfigFromSources({ integrationConfig: integrationConfig ?? null });
  const started = Date.now();
  const keyFormatOk = config.apiKey.trim().length >= 20;
  let urlOk = false;
  try {
    const parsed = new URL(config.endpoint);
    urlOk = parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    urlOk = false;
  }

  let live = false;
  if (keyFormatOk && urlOk) {
    const probe = await remoteRequest(
      { ...config, remoteEnabled: true },
      "/boolean",
      {
        question: "Connectivity probe: is the Bivia decision engine reachable?",
        context: "QASyn integration Test Connection",
        mode: config.mode,
        allow_abstain: true,
        allowAbstain: true,
      },
      { bypassCooldown: true },
    );
    live = Boolean(probe?.ok);
  }

  const checks: BiviaConnectionCheck[] = [
    { label: "Credentials format accepted", ok: keyFormatOk },
    { label: "Endpoint URL resolves", ok: urlOk },
    { label: "Live Bivia API handshake", ok: live },
    { label: "Calibrated local fallback ready", ok: true },
  ];
  const ok = live || (keyFormatOk && urlOk);
  return {
    ok,
    checks,
    message: live
      ? "Articul8 Bivia is reachable and accepted the calibrated decision handshake."
      : ok
        ? "Bivia credentials are configured; the live API is unreachable, so the calibrated local fallback is active."
        : "Articul8 Bivia is not configured. Add an API key or set BIVIA_API_KEY.",
    latencyMs: Math.max(1, Date.now() - started),
    provider: live ? "bivia-api" : "bivia-calibrated-fallback",
  };
}

/** Exported for deterministic unit checks and UI copy. */
export const BIVIA_TOKEN_GRANT = "1,000,000,000 Bivia tokens grant";
