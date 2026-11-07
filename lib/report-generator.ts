/**
 * Report generator: aggregates TestRun/TestCase/BugReport data and formats
 * CSV exports. Pure functions over the organisation's own records.
 */
export interface RunRow {
  release: number;
  version: string;
  date: string;
  status: string;
  passRate: number;
  tests: number;
  passed: number;
}

export function toCsv(rows: RunRow[]): string {
  const header = "release,version,date,status,pass_rate_pct,tests,passed";
  const body = rows.map((r) => [r.release, r.version, r.date, r.status, r.passRate, r.tests, r.passed].join(","));
  return [header, ...body].join("\n");
}

export function summaryStats(rows: RunRow[]): { avgPassRate: number; totalTests: number; totalPassed: number; bestRelease: RunRow | null } {
  if (!rows.length) return { avgPassRate: 0, totalTests: 0, totalPassed: 0, bestRelease: null };
  const avgPassRate = Math.round((rows.reduce((s, r) => s + r.passRate, 0) / rows.length) * 10) / 10;
  const totalTests = rows.reduce((s, r) => s + r.tests, 0);
  const totalPassed = rows.reduce((s, r) => s + r.passed, 0);
  const bestRelease = rows.reduce((a, b) => (b.passRate > a.passRate ? b : a));
  return { avgPassRate, totalTests, totalPassed, bestRelease };
}

/** Flakiness index: proportion of non-passing statuses per test case (0–100). */
export function flakinessIndex(statuses: string[]): number {
  if (!statuses.length) return 0;
  const flaky = statuses.filter((s) => s === "flaky" || s === "failing").length;
  return Math.round((flaky / statuses.length) * 100);
}
