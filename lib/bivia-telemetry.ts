/**
 * Articul8 Bivia — persistent token ledger and observatory.
 *
 * Every calibrated decision (boolean, choice, ground, score, set) appends one
 * NDJSON line to `.qasyn-data/bivia-telemetry.json`. The ledger is local-only,
 * git-ignored and capped so it never grows without bound. The observatory
 * projects it into the 1B token grant widget used by Billing, Integrations and
 * the Overview.
 *
 * Only derived estimates are stored: no prompt text, DOM excerpt, image bytes
 * or API key is ever written to disk.
 */
import fs from "node:fs";
import path from "node:path";

export const BIVIA_TOKEN_GRANT_COUNT = 1_000_000_000;
export const BIVIA_TOKEN_GRANT_LABEL = "1,000,000,000";

export type BiviaDecisionKind = "boolean" | "choice" | "ground" | "score" | "set";

export interface BiviaTelemetryEntry {
  id: string;
  at: string;
  kind: BiviaDecisionKind;
  provider: string;
  status: "answered" | "abstained";
  /** Raw calibrated probability in [0,1]. Ground decisions use their confidence. */
  probability: number;
  latencyMs: number;
  inputTokens: number;
  textTokens: number;
  imageTokens: number;
  outputTokens: number;
  organisationId: string | null;
  mode: string | null;
}

export interface BiviaObservatorySummary {
  grant: number;
  grantLabel: string;
  used: number;
  remaining: number;
  usedPct: number;
  decisions: number;
  counts: Record<BiviaDecisionKind, number>;
  answered: number;
  abstained: number;
  avgConfidencePct: number;
  abstentionRatePct: number;
  avgLatencyMs: number;
  estimatedCostSaved: number;
  imageTokens: number;
  textTokens: number;
  providerSplit: { api: number; fallback: number };
  lastDecisionAt: string | null;
}

const MAX_ENTRIES = 5_000;
const LEDGER_DIR = path.join(process.cwd(), ".qasyn-data");
const LEDGER_PATH = path.join(LEDGER_DIR, "bivia-telemetry.json");

function emptySummary(): BiviaObservatorySummary {
  return {
    grant: BIVIA_TOKEN_GRANT_COUNT,
    grantLabel: BIVIA_TOKEN_GRANT_LABEL,
    used: 0,
    remaining: BIVIA_TOKEN_GRANT_COUNT,
    usedPct: 0,
    decisions: 0,
    counts: { boolean: 0, choice: 0, ground: 0, score: 0, set: 0 },
    answered: 0,
    abstained: 0,
    avgConfidencePct: 0,
    abstentionRatePct: 0,
    avgLatencyMs: 0,
    estimatedCostSaved: 0,
    imageTokens: 0,
    textTokens: 0,
    providerSplit: { api: 0, fallback: 0 },
    lastDecisionAt: null,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Rough but stable token estimate: 4 characters per text token. */
export function estimateTextTokens(text: string | null | undefined): number {
  const value = String(text ?? "").trim();
  if (!value) return 0;
  return Math.max(1, Math.ceil(value.length / 4));
}

/**
 * Screenshots are sent as base64 images. A byte is ~1.33 base64 characters and
 * multimodal image tokens are estimated at one token per 6 base64 characters.
 */
export function estimateImageTokens(base64: string | null | undefined): number {
  const value = String(base64 ?? "");
  if (!value) return 0;
  return Math.max(1, Math.ceil(value.length / 6));
}

function safeReadEntries(): BiviaTelemetryEntry[] {
  try {
    const raw = fs.readFileSync(LEDGER_PATH, "utf8");
    const entries: BiviaTelemetryEntry[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as Partial<BiviaTelemetryEntry>;
        if (!parsed || typeof parsed !== "object" || !parsed.kind) continue;
        entries.push({
          id: String(parsed.id ?? `${parsed.at ?? ""}-${entries.length}`),
          at: String(parsed.at ?? new Date().toISOString()),
          kind: parsed.kind as BiviaDecisionKind,
          provider: String(parsed.provider ?? "bivia-calibrated-fallback"),
          status: parsed.status === "abstained" ? "abstained" : "answered",
          probability: Number(parsed.probability ?? 0) || 0,
          latencyMs: Number(parsed.latencyMs ?? 0) || 0,
          inputTokens: Number(parsed.inputTokens ?? 0) || 0,
          textTokens: Number(parsed.textTokens ?? 0) || 0,
          imageTokens: Number(parsed.imageTokens ?? 0) || 0,
          outputTokens: Number(parsed.outputTokens ?? 0) || 0,
          organisationId: parsed.organisationId ? String(parsed.organisationId) : null,
          mode: parsed.mode ? String(parsed.mode) : null,
        });
      } catch {
        /* skip malformed line */
      }
    }
    return entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries;
  } catch {
    return [];
  }
}

function compactLedger(entries: BiviaTelemetryEntry[]) {
  if (entries.length <= MAX_ENTRIES) return;
  try {
    const kept = entries.slice(-MAX_ENTRIES);
    fs.writeFileSync(LEDGER_PATH, `${kept.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  } catch {
    /* best-effort compaction */
  }
}

export interface RecordBiviaDecisionInput {
  kind: BiviaDecisionKind;
  provider: string;
  status: "answered" | "abstained";
  probability: number;
  latencyMs: number;
  question?: string | null;
  context?: string | null;
  screenshotBase64?: string | null;
  organisationId?: string | null;
  mode?: string | null;
}

/**
 * Appends one decision to the ledger. Never throws: telemetry can never break a
 * decision path or an HTTP route.
 */
export function recordBiviaDecision(input: RecordBiviaDecisionInput): void {
  const textTokens = estimateTextTokens(`${input.question ?? ""}\n${input.context ?? ""}`);
  const imageTokens = estimateImageTokens(input.screenshotBase64);
  const outputTokens = 64;
  const entry: BiviaTelemetryEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    at: new Date().toISOString(),
    kind: input.kind,
    provider: input.provider,
    status: input.status,
    probability: Math.max(0, Math.min(1, Number(input.probability) || 0)),
    latencyMs: Math.max(0, Math.round(Number(input.latencyMs) || 0)),
    inputTokens: textTokens + imageTokens,
    textTokens,
    imageTokens,
    outputTokens,
    organisationId: input.organisationId ?? null,
    mode: input.mode ?? null,
  };
  try {
    fs.mkdirSync(LEDGER_DIR, { recursive: true });
    fs.appendFileSync(LEDGER_PATH, `${JSON.stringify(entry)}\n`, "utf8");
    const entries = safeReadEntries();
    compactLedger(entries);
  } catch {
    /* best-effort telemetry */
  }
}

/** Projects the persistent ledger into the observatory summary. */
export function getBiviaObservatory(organisationId?: string): BiviaObservatorySummary {
  const allEntries = safeReadEntries();
  const entries = organisationId ? allEntries.filter((entry) => entry.organisationId === organisationId) : allEntries;
  if (entries.length === 0) return emptySummary();

  const counts: Record<BiviaDecisionKind, number> = { boolean: 0, choice: 0, ground: 0, score: 0, set: 0 };
  let used = 0;
  let textTokens = 0;
  let imageTokens = 0;
  let probabilitySum = 0;
  let latencySum = 0;
  let answered = 0;
  let abstained = 0;
  let api = 0;
  let fallback = 0;
  let lastDecisionAt: string | null = null;

  for (const entry of entries) {
    if (entry.kind in counts) counts[entry.kind] += 1;
    used += entry.inputTokens + entry.outputTokens;
    textTokens += entry.textTokens;
    imageTokens += entry.imageTokens;
    probabilitySum += entry.probability;
    latencySum += entry.latencyMs;
    if (entry.status === "abstained") abstained += 1;
    else answered += 1;
    if (entry.provider === "bivia-api") api += 1;
    else fallback += 1;
    if (!lastDecisionAt || entry.at > lastDecisionAt) lastDecisionAt = entry.at;
  }

  const decisions = entries.length;
  const avgLatencyMs = decisions ? latencySum / decisions : 0;
  // Estimated avoided third-party multimodal LLM spend: $0.59 / 1M input
  // tokens + $0.0024 per orchestrated decision. Derived, never billed.
  const estimatedCostSaved = round2((used / 1_000_000) * 0.59 + decisions * 0.0024);

  return {
    grant: BIVIA_TOKEN_GRANT_COUNT,
    grantLabel: BIVIA_TOKEN_GRANT_LABEL,
    used,
    remaining: Math.max(0, BIVIA_TOKEN_GRANT_COUNT - used),
    usedPct: Math.min(100, (used / BIVIA_TOKEN_GRANT_COUNT) * 100),
    decisions,
    counts,
    answered,
    abstained,
    avgConfidencePct: round1((probabilitySum / Math.max(1, decisions)) * 100),
    abstentionRatePct: round1((abstained / Math.max(1, decisions)) * 100),
    avgLatencyMs: Math.round(avgLatencyMs),
    estimatedCostSaved,
    imageTokens,
    textTokens,
    providerSplit: { api, fallback },
    lastDecisionAt,
  };
}
