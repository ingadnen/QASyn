/**
 * Magic UI — smart locator generator.
 *
 * Produces the same family of resilient Playwright locators that the
 * 21st.dev magic-mcp workflow recommends, and scores them from most to least
 * resilient: accessible role/name > test id > label > text > raw CSS.
 */

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
}

export interface MagicLocatorResult {
  component: string;
  intent: string;
  best: LocatorCandidate | null;
  candidates: LocatorCandidate[];
  guidance: string[];
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
