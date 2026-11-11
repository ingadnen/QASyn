/**
 * Closed-loop selector healing with Articul8 Bivia.
 *
 * A failed Click / Enter / Select / Verify step is healed in four moves:
 *  1. the executor captures the rendered DOM and a Playwright screenshot;
 *  2. Magic Locator generates accessible candidates from the step intent;
 *  3. Bivia `/choice` picks and calibrates the most resilient locator;
 *  4. Bivia `/ground` returns the visual bounding box of the target.
 *
 * The chosen candidate is stored as a `page.getBy…` expression (readable in
 * Studio). `selectorToPlaywright` converts it to a selector Playwright can run.
 */
import { biviaChoice, biviaGround, type BiviaConfigSources, type BiviaMode, type BiviaStatus } from "./bivia";
import { generateMagicLocators, type LocatorCandidate } from "./magic-locator";

export interface HealableStep {
  id?: string;
  action: string;
  target: string;
  value?: string;
  selector?: string;
}

export interface BiviaGroundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rawBox: [number, number, number, number];
  space: "normalized" | "milli" | "pixels";
  label?: string;
  confidence: number;
  provider: string;
  status: BiviaStatus;
}

export interface BiviaHealDecision {
  status: "healed" | "abstained";
  oldSelector: string;
  newSelector: string | null;
  probability: number;
  probabilityPct: number;
  provider: string;
  latencyMs: number;
  abstainReason?: string;
  strategy: LocatorCandidate["strategy"] | null;
  candidates: LocatorCandidate[];
  grounding: BiviaGroundingBox;
  screenshotCaptured: boolean;
  domCaptured: boolean;
}

const HEALABLE_ACTIONS = new Set(["click", "enter text", "type", "fill", "select", "verify", "verify element"]);

export function isHealableAction(action: string): boolean {
  return HEALABLE_ACTIONS.has(String(action ?? "").trim().toLowerCase());
}

/**
 * Selectors that obviously cannot resolve. Empty selectors are valid (the
 * executor auto-resolves them), so only explicit drift markers are treated as
 * corrupt.
 */
export function isCorruptSelector(selector: string | null | undefined): boolean {
  const value = String(selector ?? "").trim().toLowerCase();
  if (!value) return false;
  return /(broken|does-not-exist|does_not_exist|not-found|not_found|legacy-selector|missing-selector|#undefined|selector-999)/i.test(
    value,
  );
}

function escapeAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function quoteValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Converts a stored Studio locator into a Playwright selector string.
 * Supports `css:` prefixes, `page.getByRole/TestId/Label/Placeholder/Text` and
 * `page.locator(...)`.
 */
export function selectorToPlaywright(raw: string | null | undefined): string {
  let value = String(raw ?? "").trim();
  if (!value) return value;
  if (/^css:/i.test(value)) return value.slice(4).trim().replace(/^css=/, "");

  const role = /^page\.getByRole\(\s*(['"`])([^'"`]+)\1\s*,\s*\{\s*name:\s*(?:\/(.+)\/([a-z]*)|(['"`])([\s\S]*?)\5)\s*\}\s*\)$/i.exec(
    value,
  );
  if (role) {
    const name = role[3] !== undefined ? `/${role[3]}/${role[4] ?? ""}` : role[6];
    return `role=${role[2]}[name=${name}]`;
  }
  const roleSimple = /^page\.getByRole\(\s*(['"`])([^'"`]+)\1\s*\)$/i.exec(value);
  if (roleSimple) return `role=${roleSimple[2]}`;

  const testId = /^page\.getByTestId\(\s*(['"`])([\s\S]*?)\1\s*\)$/i.exec(value);
  if (testId) return `[data-testid="${escapeAttr(testId[2])}"]`;

  const label = /^page\.getByLabel\(\s*(?:\/(.+)\/([a-z]*)|(['"`])([\s\S]*?)\3)\s*\)$/i.exec(value);
  if (label) return `internal:label=${label[1] !== undefined ? `/${label[1]}/${label[2] ?? ""}` : label[4]}`;

  const placeholder = /^page\.getByPlaceholder\(\s*(?:\/(.+)\/([a-z]*)|(['"`])([\s\S]*?)\3)\s*\)$/i.exec(value);
  if (placeholder) {
    const text = placeholder[1] !== undefined ? placeholder[1] : placeholder[4];
    return `[placeholder="${escapeAttr(text)}"]`;
  }

  const text = /^page\.getByText\(\s*(?:\/(.+)\/([a-z]*)|(['"`])([\s\S]*?)\3)\s*\)$/i.exec(value);
  if (text) {
    if (text[1] !== undefined) return `text=/${text[1]}/${text[2] ?? ""}`;
    return `text=${text[4]}`;
  }

  const locator = /^page\.locator\(\s*(['"`])([\s\S]*?)\1\s*\)$/i.exec(value);
  if (locator) {
    const inner = locator[2].trim();
    return /^css:/i.test(inner) ? inner.slice(4) : inner;
  }

  if (/^page\./.test(value)) return value.slice(5);
  return value;
}

/** A compact DOM fixture used when the target page cannot be inspected. */
export function syntheticDomSummary(title: string, steps: HealableStep[]): string {
  const escape = (value: string) => value.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const controls = steps
    .filter((step) => isHealableAction(step.action))
    .slice(0, 12)
    .map((step, index) => {
      const label = escape(step.target || step.value || `control ${index + 1}`);
      if (/enter|type|fill|password|email|search/i.test(`${step.action} ${step.target}`)) {
        return `<input aria-label="${label}" name="field-${index + 1}" placeholder="${label}" />`;
      }
      if (/select/i.test(step.action)) {
        return `<select aria-label="${label}" name="select-${index + 1}"><option>${label}</option></select>`;
      }
      return `<button type="button" aria-label="${label}">${label}</button>`;
    })
    .join("");
  return `<!doctype html><html><head><title>${escape(title)}</title></head><body><h1>${escape(title)}</h1><main>${controls}</main></body></html>`;
}

export interface HealSelectorInput {
  step: HealableStep;
  domSummary: string;
  url?: string;
  screenshotBase64?: string | null;
  organisationId?: string;
  sources?: BiviaConfigSources;
  mode?: BiviaMode;
}

/** Runs the calibrated locator choice and visual grounding for one failed step. */
export async function healSelectorWithBivia(input: HealSelectorInput): Promise<BiviaHealDecision> {
  const step: HealableStep = {
    action: input.step.action,
    target: input.step.target,
    value: input.step.value,
    selector: input.step.selector,
  };
  const oldSelector = String(step.selector ?? "").trim();
  const base = generateMagicLocators(step);
  const options = base.candidates.map((candidate) => candidate.selector);

  const decision = await biviaChoice({
    question: `Choose the most resilient Playwright locator to heal this failed ${step.action} step: ${step.target}`,
    options,
    context: [
      `URL: ${input.url || "(not navigated)"}`,
      `Action: ${step.action}`,
      `Target: ${step.target}`,
      `Value: ${step.value ?? ""}`,
      `Broken selector: ${oldSelector || "(empty)"}`,
      `DOM excerpt: ${input.domSummary.slice(0, 8_000)}`,
      "The old selector no longer resolves. Prefer accessible role/name > test id > label > text > CSS.",
    ].join("\n"),
    organisationId: input.organisationId,
    sources: input.sources,
    mode: input.mode,
    allowAbstain: true,
  });

  const selected =
    decision.status === "answered" && decision.optionIndex >= 0 && decision.optionIndex < base.candidates.length
      ? base.candidates[decision.optionIndex]
      : null;

  const groundingResult = await biviaGround({
    targetDescription: step.target || step.value || step.action,
    screenshotBase64: input.screenshotBase64 ?? null,
    domSummary: input.domSummary,
    organisationId: input.organisationId,
    sources: input.sources,
    mode: input.mode,
  });

  const probabilityPct = Math.round(decision.probability * 1000) / 10;
  return {
    status: selected ? "healed" : "abstained",
    oldSelector,
    newSelector: selected?.selector ?? null,
    probability: decision.probability,
    probabilityPct,
    provider: decision.provider,
    latencyMs: decision.latencyMs + groundingResult.latencyMs,
    abstainReason:
      decision.abstainReason ??
      (!selected ? "Bivia abstained; no calibrated locator met the abstention threshold." : undefined),
    strategy: selected?.strategy ?? null,
    candidates: base.candidates,
    grounding: {
      x: groundingResult.x,
      y: groundingResult.y,
      width: groundingResult.width,
      height: groundingResult.height,
      rawBox: groundingResult.rawBox,
      space: groundingResult.space,
      label: groundingResult.label,
      confidence: groundingResult.confidence,
      provider: groundingResult.provider,
      status: groundingResult.status,
    },
    screenshotCaptured: Boolean(input.screenshotBase64),
    domCaptured: Boolean(input.domSummary),
  };
}

/** Metadata persisted on a healed Studio step. */
export interface StepBiviaHealMetadata {
  healed: boolean;
  oldSelector: string;
  newSelector: string;
  probability: number;
  probabilityPct: number;
  provider: string;
  status: BiviaStatus;
  strategy: string | null;
  healedAt: string;
  screenshotCaptured: boolean;
  domCaptured: boolean;
  grounding: BiviaGroundingBox;
  abstainReason?: string;
  /** Real or generated viewport evidence captured at heal time. */
  screenshotBase64?: string;
  screenshotMime?: string;
  /** Target URL used for the heal capture (same priority as Studio grounding). */
  url?: string;
}

export function buildStepHealMetadata(
  decision: BiviaHealDecision,
  healedAt = new Date().toISOString(),
  evidence?: { screenshotBase64?: string | null; screenshotMime?: string; url?: string },
): StepBiviaHealMetadata {
  return {
    healed: decision.status === "healed",
    oldSelector: decision.oldSelector,
    newSelector: decision.newSelector ?? "",
    probability: decision.probability,
    probabilityPct: decision.probabilityPct,
    provider: decision.provider,
    status: decision.status === "healed" ? "answered" : "abstained",
    strategy: decision.strategy,
    healedAt,
    screenshotCaptured: decision.screenshotCaptured,
    domCaptured: decision.domCaptured,
    grounding: decision.grounding,
    ...(evidence?.screenshotBase64
      ? { screenshotBase64: evidence.screenshotBase64, screenshotMime: evidence.screenshotMime ?? "image/png" }
      : {}),
    ...(evidence?.url ? { url: evidence.url } : {}),
    ...(decision.abstainReason ? { abstainReason: decision.abstainReason } : {}),
  };
}

export { quoteValue };
