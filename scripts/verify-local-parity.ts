/**
 * ÉTAPE 6 — Local parity verification (Playwright, production build).
 * Run: npx tsx scripts/verify-local-parity.ts
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.QASYN_BASE ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "contextqa-dump");
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
const results: Array<{ check: string; ok: boolean; detail?: string }> = [];
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  results.push({ check: label, ok, detail });
  if (!ok) failures++;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  // ── Login ────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Work e-mail").fill("cgi@cgi.com");
  await page.locator('input[type="password"]').fill("CgiDemo2026!");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  check("Login as cgi@cgi.com reaches the dashboard", page.url().includes("/dashboard"));

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const aside = page.locator('aside nav[aria-label="Dashboard"]');
  await aside.waitFor();
  const navText = (await aside.innerText()).replace(/\s+/g, " ");
  const expected = [
    "AUTONOMOUS SDLC", "Overview", "Pull requests", "Crawl", "Code Analysis",
    "PLATFORM", "Requirements", "Test cases", "Plans", "Environment & Data", "Uploads", "Knowledge Base", "Team & access",
    "WORK", "Tunnels", "Integrations", "Billing & usage", "MCP", "Settings",
  ];
  for (const label of expected) {
    check(`Sidebar contains "${label}"`, navText.includes(label));
  }
  const forbidden = ["Web testing", "Mobile testing", "Ship", "Agent testing", "Agent suites", "Context graph", "API chains", "Testing Studio", "Visual testing", "Data profiles", "Exploratory", "Salesforce", "SAP", "Learning", "Schedules", "Reports"];
  const polluted = forbidden.filter((label) => navText.includes(label));
  check("Sidebar has no invented entries", polluted.length === 0, polluted.join(", "));

  await aside.getByRole("button", { name: /Plans/ }).click();
  await page.waitForTimeout(200);
  const plansText = (await aside.innerText()).replace(/\s+/g, " ");
  check("Plans accordion exposes Test Suites", plansText.includes("Test Suites"));
  check("Plans accordion exposes Test Plans", plansText.includes("Test Plans"));

  await aside.getByRole("button", { name: /Settings/ }).click();
  await page.waitForTimeout(200);
  const settingsText = (await aside.innerText()).replace(/\s+/g, " ");
  for (const label of ["Organization", "System audits", "Analysis Settings", "Bug Reproduction Settings", "API Tokens"]) {
    check(`Settings accordion contains "${label}"`, settingsText.includes(label));
  }
  const sidebarFooter = await page.locator("aside").first().innerText();
  check("Sidebar footer has Help & docs", sidebarFooter.includes("Help & docs"));
  check("Sidebar footer has Live chat", sidebarFooter.includes("Live chat"));
  check("Sidebar footer shows trial days", /Trial · \d+ days? left/.test(sidebarFooter));
  check("Sidebar shows the user card", sidebarFooter.includes("CGI Admin") && sidebarFooter.includes("cgi@cgi.com"));
  await page.screenshot({ path: path.join(OUT, "local-sidebar.png"), fullPage: false });

  // ── Crawl page + New Crawl modal ─────────────────────────────────────────
  await page.goto(`${BASE}/dashboard/crawl`, { waitUntil: "networkidle" });
  const headers = (await page.locator("table thead th").allInnerTexts()).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const expectedHeaders = ["name", "format", "type", "test plan", "status", "test cases", "created by", "created date", "action"];
  check("Crawl table has 9 columns", (await page.locator("table thead th").count()) === 9, `${(await page.locator("table thead th").count())} columns`);
  for (const h of expectedHeaders) check(`Crawl table column "${h}"`, headers.includes(h));
  const crawlBodyText = await page.locator("body").innerText();
  check("Crawl page shows no raw JSON", !crawlBodyText.includes('"offsetMs"') && !crawlBodyText.includes('[{"'));

  await page.getByRole("button", { name: "+ New Crawl" }).click();
  const dialog = page.getByRole("dialog", { name: "New Crawl" });
  await dialog.waitFor();
  const modalText = (await dialog.innerText()).replace(/\s+/g, " ");
  for (const bit of ["Robot QA", "Show Configuration Options", "Target URL", "Explore prompt", "Requirement Name", "Additional Context", "Cancel", "Start Crawl"]) {
    check(`New Crawl modal contains "${bit}"`, modalText.includes(bit));
  }
  const targetValue = await dialog.locator('input').first().inputValue();
  check("Target URL is prefilled with the organisation website", targetValue === "https://cgi.com", targetValue);
  await dialog.getByRole("button", { name: /Show Configuration Options/ }).click();
  await page.waitForTimeout(150);
  const configText = (await dialog.innerText()).replace(/\s+/g, " ");
  for (const bit of ["Web Application", "Mobile", "API", "Require approval", "Auto publish", "Create Test Suite", "Create Test Plan", "Positive / Happy Path"]) {
    check(`Configuration options contain "${bit}"`, configText.includes(bit));
  }
  await dialog.getByPlaceholder(/Tell Robot QA/).fill("Sign in, browse the primary navigation and validate the main heading");
  await dialog.getByPlaceholder(/Credentials, constraints|Any credentials/).fill("Use the staging account, skip payments.");
  await dialog.getByPlaceholder(/Crawl requirement|Crawl —/).fill("CGI end-to-end crawl requirement");
  await page.screenshot({ path: path.join(OUT, "local-new-crawl-modal.png") });
  await dialog.getByRole("button", { name: "Start Crawl" }).click();
  await page.waitForURL(/\/dashboard\/overview/, { timeout: 30000 });
  check("Start Crawl redirects to the live overview", page.url().includes("/dashboard/overview"));

  // Complete the crawl through the API so the list shows linked test cases.
  await page.waitForTimeout(1200);
  const crawlId = await page.evaluate(async () => {
    const r = await fetch("/api/dashboard/crawl");
    const j = await r.json();
    return j.crawls?.find((c: { status: string }) => c.status === "running")?.id ?? null;
  });
  check("A running crawl was created", Boolean(crawlId));
  if (crawlId) {
    await page.evaluate(async (id) => {
      await fetch(`/api/dashboard/crawl/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
    }, crawlId);
  }
  await page.goto(`${BASE}/dashboard/crawl`, { waitUntil: "networkidle" });
  check("Crawl table shows the created crawl", (await page.locator("table tbody tr").count()) >= 1);
  check("Crawl table shows linked test cases", (await page.locator("table tbody").innerText()).includes("Linked"));
  check("Crawl table stays free of raw JSON", !(await page.locator("body").innerText()).includes('"offsetMs"'));
  await page.screenshot({ path: path.join(OUT, "local-crawl-page.png"), fullPage: true });

  // ── Requirements Library (live 9-column layout) ──────────────────────────
  await page.goto(`${BASE}/dashboard/requirements`, { waitUntil: "networkidle" });
  const reqBody = await page.locator("body").innerText();
  check("Requirements page is the live 'Requirements Library'", reqBody.includes("Requirements Library"));
  check("Requirements toolbar has + New Requirement", (await page.getByRole("button", { name: "+ New Requirement" }).count()) === 1);
  const reqHeaders = (await page.locator("table thead th").allInnerTexts()).map((t) => t.trim().toLowerCase());
  check("Requirements table has 9 columns", reqHeaders.length === 9, `${reqHeaders.length} columns`);
  for (const h of ["name", "format", "type", "test plan", "status", "test cases", "created by", "created date", "action"]) {
    check(`Requirements column "${h}"`, reqHeaders.includes(h));
  }
  check("Requirements table shows linked test cases", /\d+\s*Linked/i.test(await page.locator("table tbody").innerText()));

  // ── Create a 4-step test case and open the Studio ────────────────────────
  const created = await page.evaluate(async () => {
    const r = await fetch("/api/dashboard/test-cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "manual", title: "End-to-End Navigation and Sign-In Flow", module: "Core", criticality: "high", stepsCount: 4 }),
    });
    return { status: r.status, body: await r.json() };
  });
  check("4-step test case created", created.status === 201, `status ${created.status}`);
  const tcId = created.body.testCases?.[0]?.id;
  const stepsJson: string = created.body.testCases?.[0]?.stepsJson ?? "";
  check("Generated stepsJson has exactly 4 steps", JSON.parse(stepsJson || "[]").length === 4, `${JSON.parse(stepsJson || "[]").length} steps`);
  check("Generated steps use cgi.com", stepsJson.includes("cgi.com"));
  check("Generated steps never use example.com", !stepsJson.includes("example.com"));
  check("Generated title is professional", !created.body.testCases?.[0]?.title?.includes("Edit a") && created.body.testCases?.[0]?.module !== "all");

  // Whole dataset scan
  const all = await page.evaluate(async () => {
    const r = await fetch("/api/dashboard/test-cases");
    return (await r.json()).testCases as Array<{ title: string; module: string; stepsJson: string }>;
  });
  const bad = all.filter((t) => t.stepsJson.includes("example.com") || /Edit a all/i.test(t.title) || t.module === "all");
  check("No test case contains example.com / 'Edit a all item' / module 'all'", bad.length === 0, bad.map((b) => b.title).join(", "));

  await page.goto(`${BASE}/dashboard/test-cases/${tcId}`, { waitUntil: "networkidle" });
  const studioBody = await page.locator("body").innerText();
  check("Studio contains no example.com", !studioBody.includes("example.com"));
  check("Studio contains no 'Edit a all item'", !studioBody.includes("Edit a all item"));
  check("Studio subtitle no longer shows debug tabs", !studioBody.includes("tabs: Test Steps"));
  const tabsText = await page.locator('[role="tablist"]').first().innerText();
  check('Tab label shows "Test Steps (4)"', tabsText.includes("Test Steps (4)"), tabsText.replace(/\s+/g, " "));
  const variableCards = await page.getByRole("heading", { name: "Test Case Variables" }).count();
  check("Only one Test Case Variables card", variableCards === 1, `${variableCards} cards`);
  const stepRows = page.locator("ol > li");
  check("Studio shows exactly 4 step rows", (await stepRows.count()) === 4, `${await stepRows.count()} rows`);
  const firstStep = await stepRows.first().innerText();
  check("Step 1 is the real cgi.com navigation", firstStep.includes("Navigate to https://cgi.com"), firstStep.replace(/\s+/g, " "));
  const handles = await page.locator('ol > li span[title="Drag to reorder"]').count();
  check("Every step row has a drag handle", handles === 4, `${handles} handles`);
  const pills = await page.locator("ol > li span.rounded-full").count();
  check("Step rows are numbered", pills >= 4, `${pills} pills`);
  const runButtons = await page.getByRole("button", { name: "▶ Run" }).count();
  check("Exactly one Run button", runButtons === 1, `${runButtons} buttons`);
  const prereq = await page.locator('select[aria-label="Add prerequisite"]').count();
  const prereqButtons = await page.getByRole("button", { name: "+ Add Prerequisite" }).count();
  check("Single clean Add Prerequisite selector", prereq === 1 && prereqButtons === 0, `selects=${prereq} buttons=${prereqButtons}`);
  check("Auto-fix rerun is available", (await page.getByRole("button", { name: "Auto-fix rerun" }).count()) === 1);

  await page.getByRole("button", { name: "▶ Run" }).click();
  await page.getByText("Execution result").waitFor({ timeout: 30000 });
  await page.waitForTimeout(500);
  const execText = await page.getByText("Execution result").locator("..").innerText();
  check("Run executes and reports per-step results", /4\/4 passed/.test(execText), execText.replace(/\s+/g, " ").slice(0, 160));

  // View Details
  await page.getByRole("button", { name: "View Details" }).first().click();
  await page.waitForTimeout(150);
  const detail = await page.locator("ol > li").first().innerText();
  check("View Details opens a clean panel", detail.includes("Selector:") && detail.includes("Step 1"));
  await page.screenshot({ path: path.join(OUT, "local-studio.png"), fullPage: true });

  // ── No browser console errors ────────────────────────────────────────────
  check("No uncaught page errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  fs.writeFileSync(
    path.join(OUT, "local-parity-report.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, failures, results }, null, 2),
  );
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`} — report: contextqa-dump/local-parity-report.json`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(2);
});
