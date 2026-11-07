import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { evaluateGuardrails, evaluateHallucination } from "@/lib/agent-testing";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  copilot: z.string().trim().min(2).max(200),
  prompt: z.string().trim().min(3).max(5000),
  response: z.string().trim().min(3).max(20000),
});

/** POST /api/dashboard/saas-ai-tools — test an embedded AI copilot/chatbot. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { copilot, prompt, response } = parsed.data;

  const knowledge = await prisma.knowledgeItem.findMany({ where: { organisationId: ctx.org.id }, select: { title: true, urlOrPath: true }, take: 20 });
  const guardrails = evaluateGuardrails(response);
  const hallucination = evaluateHallucination(response, knowledge.map((k) => ({ title: k.title, text: `${k.title} ${k.urlOrPath}` })));
  const drift = hallucination.coverage < 0.5;
  const passed = guardrails.passed && hallucination.passed;
  await audit(prisma, ctx, "saas_ai.tested", `${copilot} · ${passed ? "passed" : "failed"} · drift ${Math.round(hallucination.coverage * 100)}%`);
  return NextResponse.json({
    copilot,
    passed,
    guardrails,
    hallucination: { coverage: Math.round(hallucination.coverage * 100), findings: hallucination.findings },
    drift,
    fallbackBehavior: gradrailFallback(guardrails.passed),
  });
}

function gradrailFallback(passed: boolean) {
  return passed ? "Agent stayed within policy" : "Agent violated guardrails — fallback required";
}
