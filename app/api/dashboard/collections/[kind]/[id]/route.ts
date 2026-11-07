import { NextResponse } from "next/server";
import { CREDIT_COSTS, isCollectionKind } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { runTestCases } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { collectionActionSchema } from "@/lib/validation";

type Params = { params: Promise<{ kind: string; id: string }> };

async function findItem(kind: "suites" | "test-plans", id: string, organisationId: string) {
  return kind === "suites"
    ? prisma.testSuite.findFirst({ where: { id, organisationId } })
    : prisma.testPlan.findFirst({ where: { id, organisationId } });
}

/** PATCH /api/dashboard/collections/[kind]/[id] { action: "run" } — runs the collection's test cases. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { kind, id } = await params;
  if (!isCollectionKind(kind)) return jsonError("Unknown collection.", 404);

  const parsed = collectionActionSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const item = await findItem(kind, id, ctx.org.id);
  if (!item) return jsonError("Not found.", 404);
  const testCases = await prisma.testCase.findMany({
    where: { organisationId: ctx.org.id, ...(item.module ? { module: item.module } : {}) },
    take: 100,
  });
  if (testCases.length === 0) return jsonError("This collection has no test cases yet.", 400);

  await delay(MOCK_LATENCY_MS * 2);
  const result = await prisma.$transaction(
    async (tx) => {
      const r = await runTestCases(tx, ctx, testCases);
      const data = { testCasesCount: r.total, passRate: r.total ? Math.round((r.passed / r.total) * 1000) / 10 : 0, lastRunAt: new Date() };
      if (kind === "suites") await tx.testSuite.update({ where: { id: item.id }, data });
      else await tx.testPlan.update({ where: { id: item.id }, data });
      await spendCredits(tx, ctx.org.id, CREDIT_COSTS.suiteRun);
      return r;
    },
    { timeout: 30_000 },
  );
  await audit(prisma, ctx, kind === "suites" ? "suite.run" : "test_plan.run", `${item.name} · ${result.passed}/${result.total}`);
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { kind, id } = await params;
  if (!isCollectionKind(kind)) return jsonError("Unknown collection.", 404);
  const item = await findItem(kind, id, ctx.org.id);
  if (!item) return jsonError("Not found.", 404);
  if (kind === "suites") await prisma.testSuite.delete({ where: { id: item.id } });
  else await prisma.testPlan.delete({ where: { id: item.id } });
  await audit(prisma, ctx, kind === "suites" ? "suite.deleted" : "test_plan.deleted", item.name);
  return NextResponse.json({ ok: true });
}
