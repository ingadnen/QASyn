import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  agentEndpoint: z.string().trim().min(1).max(2000),
  guardrails: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  knowledgeBaseIds: z.array(z.string().max(60)).max(30).default([]),
});

/** GET /api/dashboard/agent-suites — evaluation suites of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const suites = await prisma.agentTestSuite.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ suites });
}

/** POST /api/dashboard/agent-suites — declare a target agent (Agentforce/LangChain/Bedrock). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, agentEndpoint, guardrails, knowledgeBaseIds } = parsed.data;
  // Knowledge references must belong to this organisation.
  const sources = await prisma.contextSource.findMany({ where: { organisationId: ctx.org.id, id: { in: knowledgeBaseIds } }, select: { id: true } });
  const suite = await prisma.agentTestSuite.create({
    data: {
      organisationId: ctx.org.id,
      name,
      agentEndpoint,
      guardrailsJson: JSON.stringify(guardrails),
      knowledgeBaseJson: JSON.stringify(sources.map((s) => s.id)),
    },
  });
  await audit(prisma, ctx, "agent_suite.created", `${name} · ${agentEndpoint.slice(0, 80)}`);
  return NextResponse.json({ suite }, { status: 201 });
}

/** DELETE via query is not used; kept for symmetry with other collections. */
export async function DELETE() {
  return jsonError("Not supported on this route.", 405);
}
