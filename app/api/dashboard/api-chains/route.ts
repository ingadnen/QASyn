import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { executeApiChain } from "@/lib/api-executor";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { apiExecuteSchema, apiTestSchema } from "@/lib/validation";

/** GET /api/dashboard/api-chains — chains of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const chains = await prisma.apiTestChain.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ chains });
}

/** POST /api/dashboard/api-chains — create a chain. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = apiTestSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const chain = await prisma.apiTestChain.create({
    data: { organisationId: ctx.org.id, name: parsed.data.name, requestsJson: JSON.stringify(parsed.data.requests) },
  });
  await audit(prisma, ctx, "api_chain.created", parsed.data.name);
  return NextResponse.json({ chain }, { status: 201 });
}

/** PATCH /api/dashboard/api-chains { chainId } — execute a chain with real HTTP. */
export async function PATCH(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = apiExecuteSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const chain = await prisma.apiTestChain.findFirst({ where: { id: parsed.data.testId, organisationId: ctx.org.id } });
  if (!chain) return jsonError("API chain not found.", 404);
  const steps = JSON.parse(chain.requestsJson || "[]");
  if (steps.length === 0) return jsonError("Add at least one request before executing.", 400);
  await delay(MOCK_LATENCY_MS * 2);
  const results = await executeApiChain(steps);
  const passed = results.every((r) => r.ok);
  const updated = await prisma.apiTestChain.update({
    where: { id: chain.id },
    data: { status: passed ? "passed" : "failed", resultsJson: JSON.stringify(results), lastRunAt: new Date() },
  });
  await spendCredits(prisma, ctx.org.id, 5, ctx.user.id);
  await audit(prisma, ctx, "api_chain.execute", `${chain.name} · ${passed ? "passed" : "failed"}`);
  return NextResponse.json({ chain: updated, results });
}
