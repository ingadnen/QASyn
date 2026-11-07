/**
 * Recon harness: opens a running QASyn (or ContextQA) instance in real
 * Playwright Chromium and captures per-route titles, console errors and
 * network requests. Usage:
 *   1) npm run build && npm run start  (in another terminal)
 *   2) npx tsx scripts/inspect-contextqa.ts [baseUrl]
 * Default base: http://localhost:3000
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";

const ROUTES = [
  "/dashboard/overview",
  "/dashboard/test-cases",
  "/dashboard/plans/suites",
  "/dashboard/plans/test-plans",
  "/dashboard/recorder",
  "/dashboard/test-studio",
  "/dashboard/crawl",
  "/dashboard/web-testing",
  "/dashboard/mobile-testing",
  "/dashboard/api-testing",
  "/dashboard/api-chains",
  "/dashboard/agent-testing",
  "/dashboard/agent-suites",
  "/dashboard/context",
  "/dashboard/environments",
  "/dashboard/data-profiles",
  "/dashboard/visual-testing",
  "/dashboard/exploratory",
  "/dashboard/export",
  "/dashboard/reports",
  "/dashboard/schedules",
  "/dashboard/salesforce",
  "/dashboard/sap",
  "/dashboard/voice-testing",
  "/dashboard/red-team",
  "/dashboard/performance",
  "/dashboard/accessibility",
  "/dashboard/uploads",
  "/dashboard/tunnels",
  "/dashboard/integrations",
  "/dashboard/billing",
  "/dashboard/mcp",
  "/dashboard/settings/organization",
  "/dashboard/settings/audits",
  "/dashboard/settings/analysis",
  "/dashboard/settings/bug-reproduction",
  "/dashboard/settings/api-tokens",
  "/platform/at-a-glance",
  "/solutions/email-testing",
  "/roi-calculator",
];

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`  [console.error] ${m.text().slice(0, 120)}`);
  });
  for (const route of ROUTES) {
    try {
      const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
      const title = await page.title();
      const modals = await page.locator("button").filter({ hasText: /^(\\+ New|Create|Add|Export)/ }).count();
      console.log(`${res?.status() ?? "?"} ${route} — "${title}" · action buttons: ${modals}`);
    } catch (e) {
      console.log(`!! ${route} — ${e instanceof Error ? e.message.split("\n")[0] : "error"}`);
    }
  }
  console.log(`Network requests captured: ${requests.length} (HAR-style names above)`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
