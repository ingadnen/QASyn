import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Work e-mail").fill("cgi@cgi.com");
await page.locator('input[type="password"]').fill("CgiDemo2026!");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
const norm = (s) => s.replace(/\s+/g, " ");

async function openAndLog(route, buttonName, label, opts = {}) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const btn = opts.exact
    ? page.getByRole("button", { name: buttonName, exact: true }).first()
    : page.getByRole("button", { name: buttonName }).first();
  if (!(await btn.count())) {
    console.log(`== ${label}: BUTTON NOT FOUND (${buttonName})`);
    return;
  }
  await btn.click();
  await page.waitForTimeout(350);
  const dialog = page.getByRole("dialog").last();
  if (!(await dialog.count())) {
    console.log(`== ${label}: NO DIALOG`);
    return;
  }
  console.log(`== ${label} ==`);
  console.log(norm(await dialog.innerText()).slice(0, 2200));
  await page.screenshot({ path: `contextqa-dump/modal-${label}.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}

await openAndLog("/dashboard/requirements", /New Requirement/, "new-requirement");
await openAndLog("/dashboard/crawl", /New Crawl/, "new-crawl");
await openAndLog("/dashboard/plans/suites", /Create Test Suite/, "create-suite");
await openAndLog("/dashboard/plans/test-plans", /New Test Plan/, "create-plan");
await openAndLog("/dashboard/environments", /New environment/, "new-environment");
await openAndLog("/dashboard/environments?tab=profiles", /New test data profile/, "new-profile");
await openAndLog("/dashboard/environments?tab=global", /New global variable/, "new-global");
await openAndLog("/dashboard/environments?tab=auth", /Add auth profile/, "add-auth");
await openAndLog("/dashboard/uploads", /Create Folder/, "create-folder");
await openAndLog("/dashboard/knowledge-base", /^Add$/, "kb-add", { exact: true });
await openAndLog("/dashboard/team", /Invite user/, "team-invite");
await openAndLog("/dashboard/tunnels", /Add machine/, "add-machine");
await openAndLog("/dashboard/test-cases", /New Test Case/, "new-test-case");
await openAndLog("/dashboard/test-cases?tab=groups", /New Step Group/, "new-step-group");
await openAndLog("/dashboard/plans/test-plans", /New Test Plan/, "plan-wizard");

await browser.close();
