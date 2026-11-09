import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Work e-mail").fill("cgi@cgi.com");
await page.locator('input[type="password"]').fill("CgiDemo2026!");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
await page.waitForLoadState("networkidle");

const ids = await page.evaluate(async () => {
  const [cases, reqs, crawls, suites, plans, prs] = await Promise.all([
    fetch("/api/dashboard/test-cases").then((r) => r.json()),
    fetch("/api/dashboard/requirements").then((r) => r.json()),
    fetch("/api/dashboard/crawl").then((r) => r.json()),
    fetch("/api/dashboard/test-suites").then((r) => r.json()).catch(() => ({})),
    fetch("/api/dashboard/test-plans").then((r) => r.json()).catch(() => ({})),
    fetch("/api/dashboard/pull-requests").then((r) => r.json()).catch(() => ({})),
  ]);
  return {
    case: cases.testCases?.[0]?.id,
    requirement: reqs.requirements?.[0]?.id,
    crawl: crawls.crawls?.[0]?.id,
    suite: suites.testSuites?.[0]?.id,
    plan: plans.testPlans?.[0]?.id,
    pr: prs.pullRequests?.[0]?.id,
  };
});
console.log("ids", ids);

const routes = {
  overview: "/dashboard/overview",
  "pull-requests": "/dashboard/pull-requests",
  crawl: "/dashboard/crawl",
  "code-analysis": "/dashboard/code-analysis",
  requirements: "/dashboard/requirements",
  "test-cases": "/dashboard/test-cases",
  "step-groups": "/dashboard/test-cases?tab=step-groups",
  suites: "/dashboard/plans/suites",
  "test-plans": "/dashboard/plans/test-plans",
  environments: "/dashboard/environments",
  "env-profiles": "/dashboard/environments?tab=profiles",
  "env-global": "/dashboard/environments?tab=global",
  "env-auth": "/dashboard/environments?tab=auth",
  uploads: "/dashboard/uploads",
  "knowledge-base": "/dashboard/knowledge-base",
  team: "/dashboard/team",
  tunnels: "/dashboard/tunnels",
  integrations: "/dashboard/integrations",
  billing: "/dashboard/billing",
  mcp: "/dashboard/mcp",
  "settings-organization": "/dashboard/settings/organization",
  "settings-audits": "/dashboard/settings/audits",
  "settings-analysis": "/dashboard/settings/analysis",
  "settings-bug-repro": "/dashboard/settings/bug-reproduction",
  "settings-api-tokens": "/dashboard/settings/api-tokens",
  "settings-api-tokens-new": "/dashboard/settings/api-tokens/new",
  "detail-requirement": ids.requirement ? `/dashboard/requirements/${ids.requirement}` : null,
  "detail-crawl": ids.crawl ? `/dashboard/crawl/${ids.crawl}` : null,
  "detail-suite": ids.suite ? `/dashboard/plans/suites/${ids.suite}` : null,
  "detail-plan": ids.plan ? `/dashboard/plans/test-plans/${ids.plan}` : null,
  studio: ids.case ? `/dashboard/test-studio/${ids.case}` : null,
};

const out = {};
for (const [key, route] of Object.entries(routes)) {
  if (!route) continue;
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  out[key] = {
    url: page.url(),
    body: (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 4000),
    headings: await page.locator("h1,h2,h3").allInnerTexts(),
    tabs: await page.locator('[role="tab"], [role="tablist"] button').allInnerTexts(),
    buttons: (await page.getByRole("button").allInnerTexts()).map((s) => s.trim()).filter(Boolean).slice(0, 80),
    tableHeaders: (await page.locator("table thead th").allInnerTexts()).map((s) => s.trim()).filter(Boolean),
  };
  console.log("done", key, out[key].headings[0] ?? "");
}
fs.writeFileSync("contextqa-dump/local-page-snapshot.json", JSON.stringify(out, null, 2));
await browser.close();
