import { normalizeWebsite } from "./utils";

/**
 * Studio grounding URL resolution shared by the client and the API routes.
 *
 * Priority:
 *   1. the URL written inside the selected step (target/value),
 *   2. variables.url → variables.targetUrl → variables.baseUrl,
 *   3. the first Navigate step's target,
 *   4. the organisation website.
 */
const URL_IN_TEXT = /https?:\/\/[^\s"'<>]+/i;

export function urlFromText(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = URL_IN_TEXT.exec(value);
  return match ? normalizeWebsite(match[0]) : null;
}

export interface GroundingUrlInput {
  stepText?: string | null;
  variables?: Record<string, unknown> | null;
  steps?: Array<{ action?: string; target?: string; value?: string }>;
  orgUrl?: string | null;
}

export function resolveGroundingUrl(input: GroundingUrlInput): string {
  const fromStep = urlFromText(input.stepText ?? "");
  if (fromStep) return fromStep;

  const variables = input.variables ?? {};
  for (const key of ["url", "targetUrl", "baseUrl"]) {
    const value = variables[key];
    if (typeof value === "string") {
      const normalized = normalizeWebsite(value);
      if (normalized) return normalized;
    }
  }

  const navigate = (input.steps ?? []).find((step) => String(step.action ?? "") === "Navigate");
  const fromNavigate = urlFromText(navigate?.target ?? "") ?? urlFromText(navigate?.value ?? "");
  if (fromNavigate) return fromNavigate;

  return normalizeWebsite(input.orgUrl ?? "") ?? "";
}
