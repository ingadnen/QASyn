import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Work e-mail").fill("cgi@cgi.com");
await page.locator('input[type="password"]').fill("CgiDemo2026!");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(/\/dashboard/, { timeout: 30000 });
await page.waitForLoadState("networkidle");

const tc = await page.evaluate(async () => {
  const r = await fetch("/api/dashboard/test-cases");
  const j = await r.json();
  return j.testCases?.[0] ?? null;
});
console.log("case", tc?.id, tc?.title);

await page.goto(`${BASE}/dashboard/test-studio/${tc.id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
console.log("tabs:", await page.locator("button", { hasText: /Test Steps \(/ }).count());
console.log("has relationships:", body.includes("Relationships"), "versions:", body.includes("Version History"));
console.log("panels:", ["Test Case", "Variables", "Used in Test", "Run History"].map((p) => `${p}=${body.includes(p)}`).join(" "));
console.log("add step:", await page.getByRole("button", { name: "Add Step" }).count());
console.log("run:", await page.getByRole("button", { name: /^Run$/ }).count());
console.log("prereq:", await page.getByRole("button", { name: /Add Prerequisite/ }).count());
console.log("edit button:", await page.getByRole("button", { name: "Edit test case" }).count());
console.log("steps:", await page.locator("ol > li").count());

// Variables panel
await page.getByRole("button", { name: "Variables", exact: true }).click();
await page.waitForTimeout(250);
console.log("variables heading:", await page.getByRole("heading", { name: "Test Case Variables" }).count());
console.log("variable inputs:", await page.locator('input[placeholder="name"]').count());

// Run History panel
await page.getByRole("button", { name: "Run History" }).click();
await page.waitForTimeout(250);
const runsText = (await page.locator("aside").last().innerText()).replace(/\s+/g, " ");
console.log("run history text:", runsText.slice(0, 180));

// Add Step modal
await page.getByRole("button", { name: "Add Step" }).click();
await page.getByRole("dialog", { name: "Create an action step" }).waitFor();
console.log("templates visible:", await page.getByRole("dialog").getByRole("button").count());
await page.screenshot({ path: "contextqa-dump/local-studio-add-step.png" });
await page.getByRole("dialog").getByRole("button", { name: /Close|Cancel/ }).first().click().catch(() => page.keyboard.press("Escape"));
await page.waitForTimeout(200);

// Edit modal
await page.getByRole("button", { name: "Edit test case" }).click();
await page.getByRole("dialog", { name: "Edit Test Case" }).waitFor();
console.log("edit fields:", await page.getByRole("dialog").locator("input, textarea, select").count());
await page.screenshot({ path: "contextqa-dump/local-studio-edit.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// Prerequisite modal
await page.getByRole("button", { name: /Add Prerequisite/ }).click();
await page.getByRole("dialog", { name: "Add Prerequisite" }).waitFor();
console.log("prereq candidates:", await page.getByRole("dialog").locator('input[type="checkbox"]').count());
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

// Version tab
await page.getByRole("button", { name: "Version History" }).click();
await page.waitForTimeout(300);
const versionText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
console.log("versions:", versionText.includes("Versions"), "restore:", versionText.includes("Restore this version"));
await page.screenshot({ path: "contextqa-dump/local-studio-versions.png", fullPage: true });

// Relationships tab
await page.getByRole("button", { name: "Relationships" }).click();
await page.waitForTimeout(300);
const relText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
console.log("relationships:", relText.includes("Test Plans"));
await page.screenshot({ path: "contextqa-dump/local-studio-relationships.png", fullPage: true });

// Run
await page.getByRole("button", { name: "Test Steps", exact: false }).first().click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /^Run$/ }).first().click();
await page.getByRole("dialog", { name: "Live" }).waitFor();
console.log("run modal open");
await page.getByText("Run complete").waitFor({ timeout: 45000 }).catch(() => console.log("run did not complete"));
await page.screenshot({ path: "contextqa-dump/local-studio-run.png" });
const dialogText = (await page.getByRole("dialog", { name: "Live" }).innerText()).replace(/\s+/g, " ");
console.log("run dialog:", dialogText.slice(0, 240));

console.log("errors:", errors.slice(0, 5));
await browser.close();
