import type { CrawlLogLine } from "./types";

/**
 * Deterministic, simulated crawl transcript for a target URL.
 * No request is ever sent to the target: pages and flows are derived from the
 * domain name so each organisation gets its own, stable "live" log.
 */

const PAGE_POOL = [
  "/", "/login", "/signup", "/pricing", "/features", "/about", "/contact", "/docs", "/blog",
  "/dashboard", "/settings", "/settings/profile", "/settings/billing", "/checkout", "/cart",
  "/account", "/integrations", "/help", "/careers", "/changelog",
];

export interface CrawlFlow {
  name: string;
  module: string;
  pages: string[];
  criticality: "critical" | "high" | "medium" | "low";
  steps: number;
}

const FLOW_POOL: CrawlFlow[] = [
  { name: "Sign up with e-mail", module: "Core", pages: ["/", "/signup"], criticality: "critical", steps: 6 },
  { name: "Log in and reach the dashboard", module: "Core", pages: ["/login", "/dashboard"], criticality: "critical", steps: 5 },
  { name: "Reset a forgotten password", module: "Core", pages: ["/login"], criticality: "high", steps: 5 },
  { name: "Navigate the main menu", module: "Core", pages: ["/", "/features", "/about"], criticality: "medium", steps: 4 },
  { name: "Compare pricing plans", module: "Billing", pages: ["/pricing"], criticality: "high", steps: 4 },
  { name: "Upgrade to a paid plan", module: "Billing", pages: ["/pricing", "/checkout"], criticality: "critical", steps: 8 },
  { name: "Update the payment method", module: "Billing", pages: ["/settings/billing"], criticality: "high", steps: 6 },
  { name: "Add an item to the cart", module: "Checkout", pages: ["/cart"], criticality: "high", steps: 5 },
  { name: "Complete checkout", module: "Checkout", pages: ["/cart", "/checkout"], criticality: "critical", steps: 9 },
  { name: "Edit profile details", module: "Settings", pages: ["/settings/profile"], criticality: "medium", steps: 5 },
  { name: "Change notification preferences", module: "Settings", pages: ["/settings"], criticality: "low", steps: 4 },
  { name: "Submit the contact form", module: "Core", pages: ["/contact"], criticality: "medium", steps: 5 },
  { name: "Search the documentation", module: "Docs", pages: ["/docs"], criticality: "low", steps: 3 },
];

function hashOf(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(pool: T[], seed: number, count: number, keepFirst = 0): T[] {
  const head = pool.slice(0, keepFirst);
  const rest = pool.slice(keepFirst).map((item, i) => ({ item, k: hashOf(`${seed}:${i}`) })).sort((a, b) => a.k - b.k);
  return [...head, ...rest.slice(0, Math.max(0, count - keepFirst)).map((r) => r.item)];
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
}

export function crawlPlan(targetUrl: string) {
  const host = hostFromUrl(targetUrl);
  const seed = hashOf(host);
  const pages = pick(PAGE_POOL, seed, 9 + (seed % 6), 3);
  const flows = pick(FLOW_POOL, seed >>> 3, 7 + (seed % 4), 2);
  return { host, seed, pages, flows };
}

/** Full transcript with timing offsets (ms since the crawl started). */
export function buildCrawlLogs(targetUrl: string): CrawlLogLine[] {
  const { host, seed, pages, flows } = crawlPlan(targetUrl);
  const lines: CrawlLogLine[] = [];
  let t = 0;
  const push = (tag: CrawlLogLine["tag"], message: string, gap: number) => {
    t += gap;
    lines.push({ offsetMs: t, tag, message });
  };

  push("INFO", `aqe crawl --target ${targetUrl} --depth 3`, 200);
  push("INFO", `Resolving ${host} · sandboxed browser ready`, 900);
  push("CRAWL", `GET ${targetUrl}/ · 200 · ${120 + (seed % 180)} ms`, 1400);
  pages.slice(1).forEach((page, i) => {
    const ms = 80 + ((seed >>> (i % 16)) % 260);
    push("CRAWL", `GET ${host}${page} · 200 · ${ms} ms`, 1700 + (i % 3) * 500);
    if (i === 2) push("INFO", `Detected ${2 + (seed % 4)} forms and ${8 + (seed % 9)} interactive elements`, 900);
    if (i === 4) push("WARN", `${host}${page} · slow LCP (${(2.4 + (seed % 9) / 10).toFixed(1)} s)`, 800);
  });
  flows.forEach((flow, i) => {
    push("MAP", `Flow mapped · ${flow.name} (${flow.module}, ${flow.steps} steps)`, 2200 + (i % 2) * 700);
  });
  push("INFO", `Building journey graph · ${pages.length} pages · ${flows.length} flows`, 1800);
  push("INFO", "Waiting for more pages… (crawl keeps running)", 2500);
  return lines;
}

/** Lines visible `elapsedMs` after the crawl started. */
export function visibleCrawlLines(lines: CrawlLogLine[], elapsedMs: number): CrawlLogLine[] {
  return lines.filter((l) => l.offsetMs <= elapsedMs);
}

export function crawlProgress(targetUrl: string, elapsedMs: number) {
  const { pages, flows } = crawlPlan(targetUrl);
  const lines = buildCrawlLogs(targetUrl);
  const visible = visibleCrawlLines(lines, elapsedMs);
  return {
    pagesVisited: Math.min(pages.length, visible.filter((l) => l.tag === "CRAWL").length),
    flowsMapped: Math.min(flows.length, visible.filter((l) => l.tag === "MAP").length),
    totalPages: pages.length,
    totalFlows: flows.length,
  };
}
