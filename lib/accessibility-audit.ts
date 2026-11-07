/**
 * Accessibility audit: simulated WCAG 2.1 AA checks (axe-core style report).
 */
export interface A11yIssue {
  rule: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  wcag: string;
  description: string;
  count: number;
}

export function runA11yAudit(html: string): { issues: A11yIssue[]; passed: boolean; score: number } {
  const issues: A11yIssue[] = [];
  const images = html.match(/<img\b[^>]*>/gi) ?? [];
  const withoutAlt = images.filter((i) => !/alt=/.test(i)).length;
  if (withoutAlt) issues.push({ rule: "image-alt", severity: "serious", wcag: "1.1.1", description: "Images must have alternative text", count: withoutAlt });
  const inputs = html.match(/<input\b[^>]*>/gi) ?? [];
  const withoutLabel = inputs.filter((i) => !/aria-label=|aria-labelledby=/.test(i)).length;
  if (withoutLabel) issues.push({ rule: "label", severity: "serious", wcag: "3.3.2", description: "Form elements must have labels", count: withoutLabel });
  if (!/<html[^>]*lang=/i.test(html)) issues.push({ rule: "html-has-lang", severity: "moderate", wcag: "3.1.1", description: "The html element must have a lang attribute", count: 1 });
  if (!/<title>/i.test(html)) issues.push({ rule: "document-title", severity: "moderate", wcag: "2.4.2", description: "Documents must have a title", count: 1 });
  const buttons = html.match(/<button\b[^>]*>([^<]*)<\/button>/gi) ?? [];
  const emptyButtons = buttons.filter((b) => /<button[^>]*>\s*<\/button>/i.test(b)).length;
  if (emptyButtons) issues.push({ rule: "button-name", severity: "serious", wcag: "4.1.2", description: "Buttons must have discernible text", count: emptyButtons });
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + (i.severity === "critical" ? 20 : i.severity === "serious" ? 12 : i.severity === "moderate" ? 6 : 3) * Math.min(i.count, 3), 0));
  return { issues, passed: issues.length === 0, score };
}
