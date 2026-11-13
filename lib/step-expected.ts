/**
 * Human-readable expected results for every executable step.
 * Pure module (no server imports) so both the API/engine and the Studio client
 * can derive a sensible expectation for legacy steps that predate the field.
 */

export interface ExpectedStepShape {
  action?: string;
  target?: string;
  value?: string;
  expectedResult?: string;
}

/** Deterministic expected result derived from the action, target and value. */
export function defaultExpectedResultForStep(step: ExpectedStepShape): string {
  const action = String(step.action ?? "").trim().toLowerCase();
  const target = String(step.target ?? "").trim();
  const value = String(step.value ?? "").trim();
  const quoted = /["“]([^"”]{2,80})["”]/.exec(target)?.[1]?.trim();
  const focus = quoted || target.replace(/[.?!]+$/, "").slice(0, 90) || "the target control";

  switch (action) {
    case "navigate":
      return /^https?:\/\//i.test(target)
        ? `${target} loads with HTTP 200 OK and renders the primary document shell without blocking errors.`
        : `The target URL loads with HTTP 200 OK and renders the primary document shell without blocking errors.`;
    case "click":
      return `Clicking ${focus} responds, updates the active view or menu state, and keeps the layout stable.`;
    case "enter text":
    case "type":
    case "fill":
      return `${focus} accepts "${value || "the provided value"}", shows the expected validation state, and keeps the form usable.`;
    case "select":
      return `${focus} exposes the requested option and updates the bound state without validation errors.`;
    case "verify":
    case "verify element":
      return `${focus} is visible in the viewport, matches the expected content, and stays legible at the current scroll position.`;
    case "api call":
      return `The endpoint returns a 2xx response with the documented content-type, schema and latency budget.`;
    case "ai assertion":
      return `QASyn Vision AI visual verification confirms ${focus} renders correctly with zero console errors and zero 5xx network failures.`;
    case "ocr/document validation":
      return `The captured document is legible, the expected fields are extracted, and values match the source.`;
    case "kyc check":
      return `Identity evidence satisfies the configured KYC rules with no blocking mismatches.`;
    case "salesforce workflow steps":
      return `The Salesforce workflow completes with the expected record state and no validation errors.`;
    default:
      return `${focus} completes successfully and the page remains stable with no console errors.`;
  }
}

/** Returns the persisted expectation or a deterministic default. */
export function expectedResultForStep(step: ExpectedStepShape): string {
  const explicit = String(step.expectedResult ?? "").trim();
  return explicit || defaultExpectedResultForStep(step);
}
