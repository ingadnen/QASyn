/**
 * Magic UI — smart locator generator.
 *
 * Produces the same family of resilient Playwright locators that the
 * 21st.dev magic-mcp workflow recommends, and scores them from most to least
 * resilient: accessible role/name > test id > label > text > raw CSS.
 *
 * Articul8 Bivia calibrates the final choice with an abstention-aware
 * probability while the deterministic ranking remains the offline fallback.
 */
import { biviaChoice, type BiviaConfigSources, type BiviaMode } from "./bivia";

export interface LocatorStepInput {
  action: string;
  target: string;
  value?: string;
  selector?: string;
}

export interface LocatorCandidate {
  strategy: "Role" | "Test ID" | "Label" | "Text" | "CSS";
  selector: string;
  score: number;
  component: string;
  reason: string;
  /** Articul8 Bivia calibrated probability (0–100) for the chosen locator. */
  calibratedProbability?: number;
}

export interface MagicBiviaCalibration {
  status: "answered" | "abstained";
  provider: string;
  probability: number;
  probabilityPct: number;
  chosenSelector: string | null;
  abstainReason?: string;
  latencyMs: number;
}

export interface MagicLocatorResult {
  component: string;
  intent: string;
  best: LocatorCandidate | null;
  candidates: LocatorCandidate[];
  guidance: string[];
  /** Present when the request was calibrated by Articul8 Bivia. */
  bivia?: MagicBiviaCalibration;
}

export interface MagicLocatorOptions {
  organisationId?: string;
  sources?: BiviaConfigSources;
  mode?: BiviaMode;
  /** Honours the Analysis Settings toggle; false skips Bivia entirely. */
  enabled?: boolean;
}

function clean(value: string): string {
  return value
    .replace(/\*?\|[\w.-]+\|/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(click on|click|navigate to|navigate|enter|type|fill|verify that|verify)\s+/i, "")
    .replace(/\s+in\s+the\s+.+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "target";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isInput(action: string, target: string): boolean {
  return /enter|type|fill|input|field|password|email|search/i.test(`${action} ${target}`);
}

function inferComponent(action: string, target: string): string {
  const lower = `${action} ${target}`.toLowerCase();
  if (/heading|title|h1|h2/.test(lower)) return "Heading";
  if (/link|href|navigation/.test(lower)) return "Link";
  if (/checkbox|radio|toggle/.test(lower)) return "Checkbox";
  if (/select|dropdown|combobox/.test(lower)) return "Select";
  if (isInput(action, target)) return "TextField";
  if (/click|button|submit|sign in|login|continue|next/.test(lower)) return "Button";
  if (/image|logo|icon/.test(lower)) return "Image";
  return "Element";
}

function roleFor(component: string): string {
  switch (component) {
    case "Heading": return "heading";
    case "Link": return "link";
    case "Checkbox": return "checkbox";
    case "Select": return "combobox";
    case "TextField": return "textbox";
    case "Button": return "button";
    case "Image": return "img";
    default: return "*";
  }
}

export function generateMagicLocators(step: LocatorStepInput): MagicLocatorResult {
  const label = clean(step.target) || clean(step.value ?? "") || "target";
  const component = inferComponent(step.action, step.target || step.value || "");
  const role = roleFor(component);
  const safe = escapeRegExp(label);
  const candidates: LocatorCandidate[] = [];

  if (role !== "*") {
    candidates.push({
      strategy: "Role",
      component,
      selector: `page.getByRole('${role}', { name: /${safe}/i })`,
      score: component === "TextField" ? 94 : 96,
      reason: "Accessible role + name: resilient to DOM/CSS refactors and validates accessibility.",
    });
  }

  candidates.push({
    strategy: "Test ID",
    component,
    selector: `page.getByTestId('${slug(label)}')`,
    score: 90,
    reason: "data-testid is an explicit test contract and survives layout changes.",
  });

  if (isInput(step.action, step.target)) {
    candidates.push({
      strategy: "Label",
      component,
      selector: `page.getByLabel(/${safe}/i)`,
      score: 88,
      reason: "Label association is required for accessible forms and beats CSS for inputs.",
    });
  }

  candidates.push({
    strategy: "Text",
    component,
    selector: `page.getByText(/${safe}/i)`,
    score: 76,
    reason: "Visible text is user-facing but can change with copy edits or localisation.",
  });

  const existing = (step.selector || "").trim();
  const cssSelector = existing.startsWith("css:")
    ? existing.slice(4)
    : existing || (component === "Button"
      ? `button[type="submit"]`
      : `text=${label}`);
  candidates.push({
    strategy: "CSS",
    component,
    selector: `page.locator(${JSON.stringify(cssSelector)})`,
    score: existing ? 62 : 48,
    reason: existing
      ? "Existing CSS selector kept as fallback; prefer role/test-id when available."
      : "Generated fallback CSS; brittle when markup or class names change.",
  });

  candidates.sort((a, b) => b.score - a.score);
  return {
    component,
    intent: `${step.action} ${label}`.trim(),
    best: candidates[0] ?? null,
    candidates,
    guidance: [
      "Prefer getByRole with an accessible name for interactive controls.",
      "Add data-testid only where role/label cannot uniquely identify the element.",
      "Keep CSS selectors as a last-resort fallback, never as the primary locator.",
    ],
  };
}

/**
 * Generates candidate locators, then asks Articul8 Bivia to pick and calibrate
 * the best one. The chosen candidate moves to the front so Studio's "Apply Best
 * Locator" always uses the calibrated decision. Abstentions keep the
 * deterministic ranking and surface the exact reason + confidence.
 */
export async function generateCalibratedMagicLocators(
  step: LocatorStepInput,
  options: MagicLocatorOptions = {},
): Promise<MagicLocatorResult> {
  const base = generateMagicLocators(step);
  if (options.enabled === false || base.candidates.length === 0) return base;

  const decision = await biviaChoice({
    question: `Choose the most resilient Playwright locator for: ${base.intent}`,
    options: base.candidates.map((candidate) => candidate.selector),
    context: [
      `Component: ${base.component}`,
      `Action: ${step.action}`,
      `Target: ${step.target}`,
      `Value: ${step.value ?? ""}`,
      `Existing selector: ${step.selector ?? ""}`,
      "Priority: accessible role/name > test id > label > text > CSS.",
    ].join("\n"),
    organisationId: options.organisationId,
    sources: options.sources,
    mode: options.mode,
    allowAbstain: true,
  });

  const probabilityPct = Math.round(decision.probability * 1000) / 10;
  const calibrated = base.candidates.map((candidate, index) => ({
    ...candidate,
    ...(index === decision.optionIndex ? { calibratedProbability: probabilityPct } : {}),
  }));
  const selected =
    decision.status === "answered" && decision.optionIndex >= 0 && decision.optionIndex < calibrated.length
      ? calibrated[decision.optionIndex]
      : null;
  const candidates = selected
    ? [selected, ...calibrated.filter((_, index) => index !== decision.optionIndex)]
    : calibrated;

  return {
    ...base,
    best: candidates[0] ?? base.best,
    candidates,
    bivia: {
      status: decision.status,
      provider: decision.provider,
      probability: decision.probability,
      probabilityPct,
      chosenSelector: selected?.selector ?? null,
      latencyMs: decision.latencyMs,
      ...(decision.abstainReason ? { abstainReason: decision.abstainReason } : {}),
    },
  };
}
