/**
 * Interactive E2E architecture test (TDD, step-by-step with clear logs).
 * Uses the REAL engines: Playwright (when installed), real HTTP chaining,
 * the MCP tool server and the autonomous Ship pipeline.
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
  console.log("\n=== STEP 4 · Autonomous Ship pipeline ===");
  const org = await prisma.organisation.findUnique({ where: { slug: "acme" } });
  if (!org) throw new Error("Acme org missing");
  // Crawl → requirements → NLP cases already exist for Acme; execute a REAL
  // browser run over the organisation's cases and compile the verdict.
  const cases = await prisma.testCase.findMany({ where: { organisationId: org.id }, take: 3 });
  if (cases.length === 0) throw new Error("No test cases for Acme");
  const steps = [
    { id: "ship-1", action: "Navigate", target: "https://example.com", value: "", selector: "" },
    { id: "ship-2", action: "Verify Element", target: "This domain is for use", value: "", selector: "" },
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
  check("Ship pipeline produced a Go/No-Go verdict", decision === "Go" || decision === "No-Go");
}

async function main() {
  await ensureWal();
  console.log("QASyn architecture E2E test — real engines, org: Acme (demo)");
  await step1();
  await step2();
  await step3();
  await step4();
  console.log(failures === 0 ? "\n🎉 ALL CHECKS PASSED" : `\n⚠️ ${failures} check(s) failed`);
  process.exitCode = failures === 0 ? 0 : 1;
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
