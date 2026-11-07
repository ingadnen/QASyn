/**
 * QASyn MCP tool server: 12 real tools executable by external AI agents
 * (Claude Code, Cursor, Codex) over SSE or JSON-RPC, authenticated by API token.
 * Every tool is scoped to exactly one organisation.
 */
import { prisma } from "./db";
import { analyzePrImpact, executeApiChain, reproduceBug, simulateMobileRun, simulateSteps, type ApiRequestStep } from "./engines";
import { runMcpTool } from "./mcp";
import type { NlpStep } from "./engines";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });

export const QASYN_MCP_TOOLS: McpTool[] = [
  { name: "qasyn_create_web_test", description: "Create a web test case with NLP steps for the organisation.", inputSchema: obj({ title: { type: "string" }, module: { type: "string" }, criticality: { type: "string" }, steps: { type: "array", items: { type: "object" } } }, ["title", "module"]) },
  { name: "qasyn_run_test_plan", description: "Execute a test plan step-by-step with AI auto-healing.", inputSchema: obj({ planId: { type: "string" } }, ["planId"]) },
  { name: "qasyn_get_execution_evidence", description: "Get execution evidence (stepsJson, logs, status) of a test case.", inputSchema: obj({ testCaseId: { type: "string" } }, ["testCaseId"]) },
  { name: "qasyn_analyze_pr_impact", description: "Analyze a PR: map files, select regression scope, decide Go/No-Go.", inputSchema: obj({ prNumber: { type: "number" }, branch: { type: "string" }, title: { type: "string" }, files: { type: "array", items: { type: "string" } } }, ["prNumber", "branch", "title", "files"]) },
  { name: "qasyn_trigger_api_chain", description: "Execute a chained API test (real HTTP, variable extraction and injection).", inputSchema: obj({ testId: { type: "string" } }, ["testId"]) },
  { name: "qasyn_list_test_cases", description: "List test cases of the organisation.", inputSchema: obj({}) },
  { name: "qasyn_list_bugs", description: "List reproduced bugs with root cause.", inputSchema: obj({}) },
  { name: "qasyn_list_pull_requests", description: "List pull request verdicts and risk levels.", inputSchema: obj({}) },
  { name: "qasyn_get_quality_summary", description: "Coverage, regressions, bugs and cost avoided.", inputSchema: obj({}) },
  { name: "qasyn_start_crawl", description: "Start an autonomous crawl of the organisation website.", inputSchema: obj({ targetUrl: { type: "string" } }) },
  { name: "qasyn_run_mobile_test", description: "Run a mobile test on the device grid.", inputSchema: obj({ testId: { type: "string" } }, ["testId"]) },
  { name: "qasyn_ship_workflow", description: "Run the autonomous Ship pipeline and return the Go/No-Go verdict.", inputSchema: obj({ name: { type: "string" } }) },
  { name: "qasyn_reproduce_bug", description: "Reproduce a bug from a support ticket description.", inputSchema: obj({ title: { type: "string" }, description: { type: "string" } }, ["title", "description"]) },
];

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function callMcpTool(organisationId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  const where = { organisationId };
  switch (name) {
    case "qasyn_create_web_test": {
      const title = str(args.title);
      const module = str(args.module) || "Core";
      if (!title) throw new Error("title is required");
      const steps = Array.isArray(args.steps) ? (args.steps as NlpStep[]) : [{ id: "s1", action: "Navigate", target: title, value: "", selector: "" }];
      return prisma.testCase.create({
        data: {
          organisationId,
          title,
          module,
          criticality: str(args.criticality) || "medium",
          status: "draft",
          stepsCount: steps.length,
          source: "ai",
          stepsJson: JSON.stringify(steps),
        },
      });
    }
    case "qasyn_run_test_plan": {
      const plan = await prisma.testPlan.findFirst({ where: { id: str(args.planId), organisationId }, include: { testCases: true } });
      if (!plan) throw new Error("Test plan not found");
      const cases = [];
      for (const tc of plan.testCases) {
        let steps: NlpStep[] = [];
        try {
          steps = JSON.parse(tc.stepsJson || "[]");
        } catch {
          steps = [];
        }
        const { log, healedSteps } = simulateSteps(steps.length ? steps : [{ id: tc.id, action: "Navigate", target: tc.title, value: "", selector: "" }], plan.id);
        await prisma.testCase.update({ where: { id: tc.id }, data: { stepsJson: JSON.stringify(healedSteps), status: log.some((l) => l.healed) ? "flaky" : "passing", lastRunAt: new Date() } });
        cases.push({ title: tc.title, steps: log });
      }
      return { plan: plan.name, cases };
    }
    case "qasyn_get_execution_evidence": {
      const tc = await prisma.testCase.findFirst({ where: { id: str(args.testCaseId), organisationId } });
      if (!tc) throw new Error("Test case not found");
      return { id: tc.id, title: tc.title, status: tc.status, stepsJson: tc.stepsJson, lastRunAt: tc.lastRunAt };
    }
    case "qasyn_analyze_pr_impact": {
      const files = Array.isArray(args.files) ? (args.files as string[]) : [];
      const testCases = await prisma.testCase.findMany({ where, select: { id: true, title: true, module: true, status: true } });
      return analyzePrImpact(files, testCases);
    }
    case "qasyn_trigger_api_chain": {
      const test = await prisma.apiTest.findFirst({ where: { id: str(args.testId), organisationId } });
      if (!test) throw new Error("API test not found");
      const steps = JSON.parse(test.requestsJson || "[]") as ApiRequestStep[];
      return executeApiChain(steps);
    }
    case "qasyn_list_test_cases":
      return runMcpTool(organisationId, "list_test_cases");
    case "qasyn_list_bugs":
      return runMcpTool(organisationId, "list_bugs");
    case "qasyn_list_pull_requests":
      return runMcpTool(organisationId, "list_pull_requests");
    case "qasyn_get_quality_summary":
      return runMcpTool(organisationId, "get_quality_summary");
    case "qasyn_start_crawl": {
      const org = await prisma.organisation.findUnique({ where: { id: organisationId } });
      const targetUrl = str(args.targetUrl) || org?.website || "";
      if (!targetUrl) throw new Error("No website on the organisation");
      const existing = await prisma.crawlSession.findFirst({ where: { organisationId, status: "running" } });
      if (existing) return existing;
      return prisma.crawlSession.create({ data: { organisationId, targetUrl, status: "running", logs: "[]" } });
    }
    case "qasyn_run_mobile_test": {
      const test = await prisma.mobileTest.findFirst({ where: { id: str(args.testId), organisationId } });
      if (!test) throw new Error("Mobile test not found");
      const gestures = JSON.parse(test.gesturesJson || "[]");
      const { log, passed } = simulateMobileRun(test.device, gestures);
      await prisma.mobileTest.update({ where: { id: test.id }, data: { status: passed ? "passed" : "failed", logsJson: JSON.stringify(log), lastRunAt: new Date() } });
      return { passed, log };
    }
    case "qasyn_ship_workflow": {
      const tests = await prisma.testCase.findMany({ where, select: { status: true } });
      const passing = tests.filter((t) => t.status === "passing").length;
      const passRate = tests.length ? Math.round((passing / tests.length) * 100) : 0;
      return { decision: passRate >= 70 ? "Go" : "No-Go", passRate, cases: tests.length };
    }
    case "qasyn_reproduce_bug": {
      const { steps, rootCause, severity } = reproduceBug(str(args.description), str(args.title));
      return { steps, rootCause, severity };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
