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

// Step Groups tab
await page.goto(`${BASE}/dashboard/test-cases?tab=groups`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
console.log("STEP GROUPS H:", await page.locator("h1,h2,h3").allInnerTexts());
console.log("STEP GROUPS BODY:", norm(await page.locator("main").innerText()).slice(0, 1400));
await page.screenshot({ path: "contextqa-dump/local-step-groups.png", fullPage: true });

// New Step Group modal
const ng = page.getByRole("button", { name: /New Step Group/ }).first();
if (await ng.count()) {
  await ng.click();
  await page.waitForTimeout(300);
  const dialog = page.getByRole("dialog").first();
  console.log("STEP GROUP MODAL:", norm(await dialog.innerText()).slice(0, 1600));
  await page.keyboard.press("Escape");
}

// Suites detail
await page.goto(`${BASE}/dashboard/plans/suites`, { waitUntil: "networkidle" });
const suiteHref = await page.locator('table tbody a[href*="/plans/suites/"]').first().getAttribute("href").catch(() => null);
console.log("suite href", suiteHref);
if (suiteHref) {
  await page.goto(`${BASE}${suiteHref}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  console.log("SUITE H:", await page.locator("h1,h2,h3").allInnerTexts());
  console.log("SUITE TABS:", await page.locator('[role="tab"], [role="tablist"] button').allInnerTexts());
  console.log("SUITE BODY:", norm(await page.locator("main").innerText()).slice(0, 1600));
  await page.screenshot({ path: "contextqa-dump/local-suite-detail.png", fullPage: true });
}

// Plans detail
await page.goto(`${BASE}/dashboard/plans/test-plans`, { waitUntil: "networkidle" });
const planHref = await page.locator('table tbody a[href*="/plans/test-plans/"]').first().getAttribute("href").catch(() => null);
console.log("plan href", planHref);
if (planHref) {
  await page.goto(`${BASE}${planHref}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  console.log("PLAN H:", await page.locator("h1,h2,h3").allInnerTexts());
  console.log("PLAN TABS:", await page.locator('[role="tab"], [role="tablist"] button').allInnerTexts());
  console.log("PLAN BODY:", norm(await page.locator("main").innerText()).slice(0, 1800));
  await page.screenshot({ path: "contextqa-dump/local-plan-detail.png", fullPage: true });
}

// API token new
await page.goto(`${BASE}/dashboard/settings/api-tokens/new`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
console.log("TOKEN NEW:", norm(await page.locator("main").innerText()).slice(0, 700));

// New test case modal
await page.goto(`${BASE}/dashboard/test-cases`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /New Test Case/ }).first().click();
await page.waitForTimeout(300);
console.log("TC MODAL:", norm(await page.getByRole("dialog").first().innerText()).slice(0, 1200));
await page.keyboard.press("Escape");

// Filter + settings
await page.getByRole("button", { name: "Filter" }).click();
await page.waitForTimeout(250);
console.log("FILTER:", norm(await page.locator("body").innerText()).slice(0, 1000));
await page.keyboard.press("Escape");

await browser.close();
