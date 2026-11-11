import { NextResponse } from "next/server";
import { CREDIT_COSTS, isCollectionKind } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { runTestCases } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { collectionActionSchema, collectionUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ kind: string; id: string }> };

async function findItem(kind: "suites" | "test-plans", id: string, organisationId: string) {
  return kind === "suites"
    ? prisma.testSuite.findFirst({ where: { id, organisationId } })
    : prisma.testPlan.findFirst({ where: { id, organisationId } });
}

/** PATCH /api/dashboard/collections/[kind]/[id] { action: "run" | "link" } — runs or re-links the collection's test cases. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { kind, id } = await params;
  if (!isCollectionKind(kind)) return jsonError("Unknown collection.", 404);

  const item = await findItem(kind, id, ctx.org.id);
  if (!item) return jsonError("Not found.", 404);

  const body = (await readJson(request)) as { action?: string; testCaseIds?: string[] };
  if (body?.action === "clone") {
    const copyName = `${item.name} (Copy)`;
    if (kind === "suites") {
      const suite = await prisma.testSuite.findFirstOrThrow({ where: { id: item.id, organisationId: ctx.org.id } });
      const members = await prisma.testCase.findMany({
        where: { organisationId: ctx.org.id, testSuites: { some: { id: suite.id } } },
        select: { id: true },
      });
      const clone = await prisma.testSuite.create({
        data: {
          organisationId: ctx.org.id,
          name: copyName,
          description: suite.description,
          schedule: suite.schedule,
          module: suite.module,
          platform: suite.platform,
          labelsJson: suite.labelsJson,
          prerequisitesJson: suite.prerequisitesJson,
          projectId: suite.projectId,
          testCases: { connect: members.map((c) => ({ id: c.id })) },
        },
      });
      await audit(prisma, ctx, "test_suite.cloned", `${suite.name} → ${clone.name}`);
      return NextResponse.json({ item: clone });
    }
    const plan = await prisma.testPlan.findFirstOrThrow({ where: { id: item.id, organisationId: ctx.org.id } });
    const members = await prisma.testCase.findMany({
      where: { organisationId: ctx.org.id, testPlans: { some: { id: plan.id } } },
      select: { id: true },
    });
    const suites = await prisma.testSuite.findMany({
      where: { organisationId: ctx.org.id, plans: { some: { id: plan.id } } },
      select: { id: true },
    });
    const clone = await prisma.testPlan.create({
      data: {
        organisationId: ctx.org.id,
        name: copyName,
        description: plan.description,
        schedule: plan.schedule,
        module: plan.module,
        environment: plan.environment,
        browsersJson: plan.browsersJson,
        settingsJson: plan.settingsJson,
        projectId: plan.projectId,
        testCases: { connect: members.map((c) => ({ id: c.id })) },
        suites: { connect: suites.map((s) => ({ id: s.id })) },
      },
    });
    await audit(prisma, ctx, "test_plan.cloned", `${plan.name} → ${clone.name}`);
    return NextResponse.json({ item: clone });
  }
  if (body?.action === "link" && Array.isArray(body.testCaseIds)) {
    const cases = await prisma.testCase.findMany({
      where: { organisationId: ctx.org.id, id: { in: body.testCaseIds } },
      select: { id: true },
    });
    const data = { testCasesCount: cases.length, testCases: { set: cases.map((c) => ({ id: c.id })) } };
    const updated = kind === "suites" ? await prisma.testSuite.update({ where: { id: item.id }, data }) : await prisma.testPlan.update({ where: { id: item.id }, data });
    await audit(prisma, ctx, kind === "suites" ? "test_suite.linked" : "test_plan.linked", `${item.name} · ${cases.length} cases`);
    return NextResponse.json({ item: updated });
  }

  if (body?.action === "update") {
    const parsedUpdate = collectionUpdateSchema.safeParse(body);
    if (!parsedUpdate.success) return validationError(parsedUpdate.error);
    const input = parsedUpdate.data;
    if (kind === "suites") {
      const updated = await prisma.testSuite.update({
        where: { id: item.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.module !== undefined ? { module: input.module } : {}),
          ...(input.platform !== undefined ? { platform: input.platform } : {}),
          ...(input.labels !== undefined ? { labelsJson: JSON.stringify(input.labels) } : {}),
          ...(input.prerequisites !== undefined ? { prerequisitesJson: JSON.stringify(input.prerequisites) } : {}),
        },
      });
      await audit(prisma, ctx, "test_suite.updated", updated.name);
      return NextResponse.json({ item: updated });
    }
    const updated = await prisma.testPlan.update({
      where: { id: item.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.module !== undefined ? { module: input.module } : {}),
        ...(input.environment !== undefined ? { environment: input.environment || null } : {}),
      },
    });
    await audit(prisma, ctx, "test_plan.updated", updated.name);
    return NextResponse.json({ item: updated });
  }

  const parsed = collectionActionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
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
    { timeout: 60_000 },
  );
  await audit(prisma, ctx, kind === "suites" ? "test_suite.run" : "test_plan.run", `${item.name} · ${result.passed}/${result.total}`);
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
  await audit(prisma, ctx, kind === "suites" ? "test_suite.deleted" : "test_plan.deleted", item.name);
  return NextResponse.json({ ok: true });
}
