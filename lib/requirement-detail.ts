import type { DetailCase } from "@/components/dashboard/pages/RequirementDetail";

export interface RawDetailCase {
  id: string;
  title: string;
  module: string;
  criticality: string;
  stepsCount: number;
  status: string;
}

export function typeFor(title: string, index: number): string {
  const t = title.toLowerCase();
  if (/end.to.end|e2e|journey/.test(t)) return "End To End";
  if (/empty|required|validation|invalid|whitespace/.test(t)) return "Field Validation";
  if (/boundary|length|character|long|oversized|minimum|maximum/.test(t)) return "Boundary Value";
  if (/error|fail|declin|negative|reject/.test(t)) return "Negative";
  if (/edge|query parameters|fragment/.test(t)) return "Edge";
  return index % 3 === 0 ? "Functional" : "Positive";
}

export function priorityFor(criticality: string): string {
  const value = criticality.toLowerCase();
  if (value === "critical") return "Critical";
  if (value === "high") return "Major";
  if (value === "low") return "Minor";
  return "Medium";
}

export function detailCases(cases: RawDetailCase[]): DetailCase[] {
  return cases.map((c, index) => {
    const type = typeFor(c.title, index);
    return {
      id: c.id,
      code: `TC-${String(index + 1).padStart(2, "0")}`,
      title: c.title,
      description: `${c.module} · ${c.stepsCount} step${c.stepsCount === 1 ? "" : "s"}`,
      type,
      priority: priorityFor(c.criticality),
      prerequisite: "—",
      variables: type === "End To End" ? "*|url|" : "*|base_url|",
      decision: c.status === "draft" ? "Pending review" : "Accepted",
      status: c.status,
    };
  });
}

export function longDate(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function crawlTitle(targetUrl: string, startedAt: Date): string {
  const stamp = startedAt
    .toLocaleString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .replace(/\s/g, " ");
  return `${stamp}_${targetUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").split(".")[0] || "crawl"} Crawl`;
}
