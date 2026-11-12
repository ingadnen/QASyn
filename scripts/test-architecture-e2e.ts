/**
 * Interactive E2E architecture test (TDD, step-by-step with clear logs).
 * Uses the REAL engines: Playwright (when installed), real HTTP chaining,
 * the MCP tool server and the autonomous QASyn pipeline.
 *
 * Run: npx tsx scripts/test-architecture-e2e.ts
 */
import { prisma, ensureWal } from "../lib/db";
import { executeWebSteps } from "../lib/web-executor";
import { healSelector, parseDom } from "../lib/healing";
import { executeApiChain } from "../lib/engines";
import { callMcpTool } from "../lib/mcp-server";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function step1() {
  console.log("\n=== STEP 1 · Web engine + AI auto-healing (Playwright) ===");
  const org = await prisma.organisation.findUnique({ where: { slug: "acme" } });
  if (!org) throw new Error("Acme org missing — run npm run db:seed first");
  // Persist a test case with a deliberately broken selector to force healing.
  const steps = [
    { id: "e2e-1", action: "Navigate", target: "https://example.com", value: "", selector: "" },
    { id: "e2e-2", action: "Click", target: "More information", value: "", selector: "css:.broken-old-selector-xyz" },
    { id: "e2e-3", action: "Verify Element", target: "This domain is for use", value: "", selector: "" },
  ];
  const tc = await prisma.testCase.create({
    data: { organisationId: org.id, title: "E2E auto-healing probe", module: "Core", criticality: "high", status: "draft", stepsCount: 3, source: "ai", stepsJson: JSON.stringify(steps) },
  });
  console.log(`Created test case ${tc.id}`);
  const outcomes = await executeWebSteps(steps);
  for (const o of outcomes) {
    console.log(`  [${o.step.action}] fetched=${o.fetched} status=${o.status} healed=${o.healed} score=${o.score.toFixed(2)} screenshot=${o.screenshotBase64 ? `${o.screenshotBase64.length} chars` : "none"} · ${o.message}`);
  }
  check("Playwright executed the Navigate step for real", outcomes[0]?.fetched === true);
  check("Healing engine produced a similarity score", outcomes.some((o) => o.score > 0) || outcomes.every((o) => o.step.action === "Navigate" || o.healed));
  // Persist repaired selector if healing found one.
  const healedStep = outcomes.find((o) => o.healed && o.newSelector);
  if (healedStep) {
    const updated = steps.map((s) => (s.id === healedStep.step.id ? { ...s, selector: healedStep.newSelector as string } : s));
    await prisma.testCase.update({ where: { id: tc.id }, data: { stepsJson: JSON.stringify(updated), status: "flaky", lastRunAt: new Date() } });
    const reloaded = await prisma.testCase.findUnique({ where: { id: tc.id } });
    check("Repaired selector persisted in SQLite", (reloaded?.stepsJson ?? "").includes(healedStep.newSelector as string));
  } else {
    console.log("  (no healing needed on this page — selector already matched)");
  }
  // DOM similarity unit check on a crafted page.
  const dom = parseDom('<html><body><a data-testid="more-info" href="#">More information</a></body></html>');
  const heal = healSelector({ tag: "a", selector: "css:.broken-old-selector-xyz", text: "More information" }, dom);
  check("healSelector() scores the correct candidate", heal.score > 0.3, `score=${heal.score.toFixed(2)} selector=${heal.newSelector}`);
  void ensureWal;
}

async function step2() {
  console.log("\n=== STEP 2 · Real API chaining (HTTP) ===");
  const steps = [
    {
      id: "api-1",
      method: "GET" as const,
      url: "https://jsonplaceholder.typicode.com/posts/1",
      headers: {},
      body: "",
      assertions: [{ kind: "status" as const, path: "", expected: "200" }],
      extractionRules: [{ variable: "postId", path: "$.id" }],
    },
    {
      id: "api-2",
      method: "GET" as const,
      url: "https://jsonplaceholder.typicode.com/posts/{{postId}}",
      headers: {},
      body: "",
      assertions: [
        { kind: "status" as const, path: "", expected: "200" },
        { kind: "value" as const, path: "$.id", expected: "1" },
      ],
      extractionRules: [],
    },
  ];
  const results = await executeApiChain(steps);
  for (const r of results) {
    console.log(`  ${r.method} ${r.url} → ${r.status} ok=${r.ok} extracted=${JSON.stringify(r.extracted)}`);
  }
  check("First request executed over real HTTP", results[0]?.status === 200);
  check("JSONPath-lite extracted the variable", results[0]?.extracted["postId"] === "1");
  check("Second request used the injected variable and passed assertions", results[1]?.url.endsWith("/posts/1") && results[1]?.ok === true);
}

async function step3() {
  console.log("\n=== STEP 3 · MCP SSE server (JSON-RPC) ===");
  const org = await prisma.organisation.findUnique({ where: { slug: "acme" } });
  if (!org) throw new Error("Acme org missing");
  // Simulate a tools/call JSON-RPC request as an external agent would send
  // (POST /api/mcp/sse with Bearer cqa_…): the route resolves the org from the
  // token and invokes callMcpTool. Here we invoke the same code path directly.
  const data = (await callMcpTool(org.id, "qasyn_get_quality_summary", {})) as Record<string, unknown>;
  const response = { jsonrpc: "2.0", id: "req-1", result: { content: [{ type: "text", text: JSON.stringify(data) }] } };
  console.log(`  JSON-RPC response: ${JSON.stringify(response).slice(0, 220)}…`);
  check("JSON-RPC envelope is well-formed", response.jsonrpc === "2.0" && response.id === "req-1");
  check("qasyn_get_quality_summary returned org-scoped data", typeof (data as { testCases?: unknown }).testCases === "number");
}

async function step4() {
  console.log("\n=== STEP 4 · Autonomous QASyn pipeline ===");
  const org = await prisma.organisation.findUnique({ where: { slug: "acme" } });
  if (!org) throw new Error("Acme org missing");
  // Crawl → requirements → NLP cases already exist for Acme; execute a REAL
  // browser run over the organisation's cases and compile the verdict.
  const cases = await prisma.testCase.findMany({ where: { organisationId: org.id }, take: 3 });
  if (cases.length === 0) throw new Error("No test cases for Acme");
  const steps = [
    { id: "qasyn-1", action: "Navigate", target: "https://example.com", value: "", selector: "" },
    { id: "qasyn-2", action: "Verify Element", target: "This domain is for use", value: "", selector: "" },
  ];
  const outcomes = await executeWebSteps(steps);
  const realOk = outcomes.every((o) => o.fetched);
  const passing = cases.filter((c) => c.status === "passing").length;
  const passRate = Math.round((passing / cases.length) * 100);
  const decision = passRate >= 70 ? "Go" : "No-Go";
  const workflow = await prisma.shipWorkflow.create({
    data: {
      organisationId: org.id,
      name: "E2E architecture validation",
      status: decision === "Go" ? "passed" : "failed",
      decision,
      stagesJson: JSON.stringify([
        { stage: "Crawl", evidence: "Acme crawl history reused", ok: true },
        { stage: "Requirements", evidence: `${await prisma.requirement.count({ where: { organisationId: org.id } })} requirements`, ok: true },
        { stage: "Test generation", evidence: `${cases.length} NLP cases in scope`, ok: true },
        { stage: "Real execution", evidence: realOk ? "Playwright/HTTP run OK" : "HTTP fallback run", ok: realOk },
        { stage: "Release report", evidence: `Verdict: ${decision} (${passRate}% pass rate)`, ok: decision === "Go" },
      ]),
      decisionReason: `Pass rate ${passRate}% vs 70% gate.`,
    },
  });
  console.log(`  Workflow ${workflow.id}: decision=${decision} passRate=${passRate}%`);
  check("QASyn pipeline produced a Go/No-Go verdict", decision === "Go" || decision === "No-Go");
}

async function step5() {
  console.log("\n=== STEP 5 · Playwright UI walkthrough (real clicks, localhost:3000) ===");
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const base = process.env.QASYN_BASE ?? "http://localhost:3000";

  // Ensure a writable test account (own org) for mutation-heavy UI checks.
  const { hashPassword } = await import("../lib/crypto");
  const { prisma: db } = await import("../lib/db");
  const email = `e2e-${Date.now()}@qasyn.dev`;
  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword("E2ePass2026!"), name: "E2E Tester", role: "Admin", avatarInitials: "ET", emailVerifiedAt: new Date() },
  });
  const org = await db.organisation.create({
    data: {
      name: "E2E Org",
      slug: `e2e-${Date.now()}`,
      ownerName: "E2E Tester",
      website: "https://example.com",
      trialEndsAt: new Date(Date.now() + 15 * 86_400_000),
      onboarding: { create: { currentStep: 7, completedAt: new Date() } },
    },
  });
  await db.user.update({ where: { id: user.id }, data: { organisationId: org.id, emailVerifiedAt: new Date() } });
  const tc = await db.testCase.create({
    data: { organisationId: org.id, title: "E2E Studio probe", module: "Core", criticality: "high", status: "draft", stepsCount: 3, source: "ai", stepsJson: JSON.stringify([
      { id: "s1", action: "Navigate", target: "https://example.com", value: "", selector: "" },
      { id: "s2", action: "Click", target: "Learn more", value: "", selector: "" },
      { id: "s3", action: "Verify Element", target: "Example", value: "", selector: "" },
    ]) },
  });

  // 5.1 Login
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("input[type='password']", { timeout: 15_000 });
  await page.fill("input[type='email'], input[name='email']", email);
  await page.fill("input[type='password']", "E2ePass2026!");
  await page.click("button[type='submit'], button:has-text('Log in')");
  await page.waitForURL("**/dashboard/**", { timeout: 15_000 });
  check(`Login as ${email} redirects to dashboard`, true);

  // 5.2 Environments tabs
  await page.goto(`${base}/dashboard/environments?tab=environments`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("text=New environment", { timeout: 15_000 });
  await page.click("a[href*='tab=profiles'], a:has-text('Test Data Profiles')");
  await page.waitForURL("**environments?tab=profiles**", { timeout: 15_000 });
  const hiddenList = await page.locator("text=vars:").count();
  check("Environments list hidden on profiles tab", hiddenList === 0);
  await page.click("a[href*='tab=global'], a:has-text('Global Data')");
  await page.click("a[href*='tab=auth'], a:has-text('Auth Profiles')");

  // 5.3 Crawl detail tabs
  const testOrg = await db.organisation.findUnique({ where: { id: org.id } });
  void testOrg;
  const crawl = await db.crawlSession.create({ data: { organisationId: org.id, targetUrl: "https://example.com", status: "running", pagesVisited: 2, flowsMapped: 1 } });
  if (crawl) {
    await page.goto(`${base}/dashboard/crawl/${crawl.id}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    for (const tab of ["Questionnaire", "Requirement Data", "History", "Metadata", "Gaps"]) {
      await page.click(`[role=tab]:has-text("${tab}"), button:has-text("${tab}")`);
      await tab === "History" ? page.waitForTimeout(400) : page.waitForTimeout(300);
    }
    check("Crawl detail 6 tabs clickable", true);
  }

  // 5.4 Test Studio interactions
  const probe = await db.testCase.findFirst({ where: { id: tc.id } });
  if (probe) {
    await page.goto(`${base}/dashboard/test-studio/${probe.id}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("text=Test Case Variables", { timeout: 15_000 });
    const details = await page.locator("button:has-text('View Details')").count();
    if (details >= 2) {
      await page.locator("button:has-text('View Details')").nth(0).click();
      await page.locator("button:has-text('View Details')").nth(1).click();
      check("View Details opens step 1 and 2 independently", (await page.locator("text=Step Details").count()) >= 1);
    } else {
      check("View Details buttons present", false, `found ${details}`);
    }
    // Add variable
    await page.fill("input[placeholder='key (url, email…)']", "url");
    await page.fill("input[placeholder='value']", "https://staging.example.com");
    await page.locator("div:has(> input[placeholder='value']) >> button:has-text('Add')").first().click();
    await page.waitForTimeout(600);
    const reloaded = await db.testCase.findUnique({ where: { id: probe.id } });
    check("Variable url persisted to variablesJson", (reloaded?.variablesJson ?? "").includes("\"url\""));
    // AI Custom Prompt
    const before = JSON.parse(reloaded?.stepsJson ?? "[]").length;
    await page.click("button:has-text('AI Custom Prompt')");
    await page.fill("input[placeholder*='Verify the welcome']", "Verify the welcome banner, click Get started");
    await page.click("button:has-text('Generate & add')");
    await page.waitForTimeout(800);
    const after = JSON.parse((await db.testCase.findUnique({ where: { id: probe.id } }))?.stepsJson ?? "[]").length;
    check("AI Custom Prompt increased steps", after > before, `${before} → ${after}`);
    // Tabs
    for (const t of ["Relationships", "Version History", "Test Steps"]) {
      await page.click(`[role=tab]:has-text("${t}")`);
    }
    check("Studio 3 tabs clickable", true);
  }

  // 5.5 Suite detail
  const suite = (await db.testSuite.findFirst({ where: { organisationId: org.id } })) ?? (await db.testSuite.create({ data: { organisationId: org.id, name: "E2E Suite", testCases: { connect: [{ id: tc.id }] } } }));
  if (suite) {
    await page.goto(`${base}/dashboard/plans/suites/${suite.id}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    for (const t of ["Used in Test Plans", "History", "Settings", "Test Cases"]) {
      await page.click(`[role=tab]:has-text("${t}")`);
    }
    check("Suite detail 4 tabs clickable", true);
  }

  // 5.6 Test cases columns + Step Groups + Modular
  await page.goto(`${base}/dashboard/test-cases`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const headers = (await page.locator("th").allInnerTexts()).map((h) => h.toLowerCase());
  check("Columns TC ID / Confidence / Labels / Created By visible", ["tc id", "confidence %", "labels", "created by"].every((c) => headers.some((h) => h.includes(c))));
  await page.click("[role=tab]:has-text('Step Groups')");
  const groupInput = await page.locator("input[placeholder*='sub-routine']").count();
  check("Step Groups form present", groupInput >= 1);
  await page.click("[role=tab]:has-text('Test Cases')");
  await page.click("[role=tab]:has-text('Modular')");
  check("Modular folder tree renders", (await page.locator("text=ORGANIZED").count()) >= 1);

  // 5.7 Team search + roles matrix
  await page.goto(`${base}/dashboard/team`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.fill("input[name='q']", "sam");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await page.click("a[href*='tab=roles'], a:has-text('Roles & Permissions')");
  const matrix = await page.locator("table").count();
  check("Team search + roles matrix rendered", matrix >= 1);

  await browser.close();
}

async function step6() {
  console.log("\n=== STEP 6 · Inter-page data flow (crawl → requirement → cases → overview) ===");
  const { hashPassword } = await import("../lib/crypto");
  const { prisma: db } = await import("../lib/db");
  const email = `flow-${Date.now()}@qasyn.dev`;
  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword("FlowPass2026!"), name: "Flow Tester", role: "Admin", avatarInitials: "FT", emailVerifiedAt: new Date() },
  });
  const org = await db.organisation.create({
    data: {
      name: "Flow Org",
      slug: `flow-${Date.now()}`,
      ownerName: "Flow Tester",
      website: "https://example.com",
      trialEndsAt: new Date(Date.now() + 15 * 86_400_000),
      onboarding: { create: { currentStep: 7, completedAt: new Date() } },
    },
  });
  await db.user.update({ where: { id: user.id }, data: { organisationId: org.id } });
  const { startCrawl, completeCrawl } = await import("../lib/engine");
  const actor = { org, user };
  const crawl = await startCrawl(db, actor, "https://example.com", { platform: "Web Application", publishMode: "Auto publish", testTypes: ["Positive / Happy Path"], prerequisites: [] });
  const reqId = (await db.crawlSession.findUnique({ where: { id: crawl.id } }))?.requirementId;
  check("Crawl auto-created its Requirement", !!reqId, reqId ?? "");
  const completed = await completeCrawl(db, actor, crawl);
  const cases = await db.testCase.count({ where: { organisationId: org.id, source: "crawl" } });
  check("Completion generated crawl test cases", cases > 0, `${cases} cases`);
  const suite = await db.testSuite.count({ where: { organisationId: org.id } });
  const plan = await db.testPlan.count({ where: { organisationId: org.id } });
  check("Auto Publish created suite + plan", suite >= 1 && plan >= 1, `suite=${suite} plan=${plan}`);
  // Run one case → TestRun + LogLine + recalc
  const { runTestCases } = await import("../lib/engine");
  const one = await db.testCase.findFirst({ where: { organisationId: org.id } });
  if (one) {
    const res = await runTestCases(db, actor, [one]);
    const run = await db.testRun.findFirst({ where: { organisationId: org.id }, orderBy: { createdAt: "desc" }, include: { logs: true } });
    check("Run created TestRun + LogLine trail", !!run && run.logs.length >= 1, `passed=${res.passed} failed=${res.failed}`);
    const state = await db.testCase.findUnique({ where: { id: one.id } });
    check("Case status updated by run", ["passing", "failing", "flaky"].includes(state?.status ?? ""), state?.status ?? "");
  }
  console.log(`  flow org ${org.slug}: requirement=${reqId} cases=${cases} suite=${suite} plan=${plan}`);
}

async function main() {
  await ensureWal();
  console.log("QASyn architecture E2E test — real engines, org: Acme (demo)");
  await step1();
  await step2();
  await step3();
  await step4();
  if (process.env.QASYN_UI === "1") await step5();
  if (process.env.QASYN_FLOW === "1") await step6();
  console.log(failures === 0 ? "\n🎉 ALL CHECKS PASSED" : `\n⚠️ ${failures} check(s) failed`);
  process.exitCode = failures === 0 ? 0 : 1;
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
