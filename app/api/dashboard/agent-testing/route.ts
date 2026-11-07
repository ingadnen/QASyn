import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { evaluateGuardrails, evaluateHallucination, evaluateToolCalls } from "@/lib/agent-testing";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["guardrail", "hallucination", "toolcall"]),
  /** Model response text (guardrail/hallucination) or tool calls array (toolcall). */
  input: z.union([z.string().max(20000), z.array(z.record(z.string(), z.unknown())).max(50)]),
});

/** GET /api/dashboard/agent-testing — agent evaluations of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const tests = await prisma.agentTest.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, take: 30 });
  return NextResponse.json({ tests });
}

/** POST /api/dashboard/agent-testing — create and immediately evaluate an agent test. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, kind, input } = parsed.data;

  let results: unknown[] = [];
  let passed = false;
  if (kind === "guardrail") {
    if (typeof input !== "string") return jsonError("Guardrail tests need a text input.", 400);
    const r = evaluateGuardrails(input);
    results = r.findings;
    passed = r.passed;
  } else if (kind === "hallucination") {
    if (typeof input !== "string") return jsonError("Hallucination tests need a text input.", 400);
    const knowledge = await prisma.knowledgeItem.findMany({ where: { organisationId: ctx.org.id }, select: { title: true, urlOrPath: true }, take: 20 });
    const r = evaluateHallucination(input, knowledge.map((k) => ({ title: k.title, text: `${k.title} ${k.urlOrPath}` })));
    results = [...r.findings, { category: "coverage", severity: "low", message: `Knowledge coverage: ${Math.round(r.coverage * 100)}%` }];
    passed = r.passed;
  } else {
    if (!Array.isArray(input)) return jsonError("Tool-call tests need an array input.", 400);
    const r = evaluateToolCalls(input);
    results = r.findings;
    passed = r.passed;
  }

  const test = await prisma.agentTest.create({
    data: {
      organisationId: ctx.org.id,
      name,
      kind,
      inputJson: JSON.stringify(input),
      resultsJson: JSON.stringify(results),
      status: passed ? "passed" : "failed",
      lastRunAt: new Date(),
    },
  });
  await audit(prisma, ctx, "agent_test.run", `${name} · ${kind} · ${passed ? "passed" : "failed"}`);
  return NextResponse.json({ test, results }, { status: 201 });
}
