import { NextResponse } from "next/server";
import { isCollectionKind as isKind } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { collectionSchema } from "@/lib/validation";

type Params = { params: Promise<{ kind: string }> };

export async function GET(_request: Request, { params }: Params) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const { kind } = await params;
  if (!isKind(kind)) return jsonError("Unknown collection.", 404);
  const where = { organisationId: guard.ctx.org.id };
  const items =
    kind === "suites"
      ? await prisma.testSuite.findMany({ where, orderBy: { createdAt: "desc" } })
      : await prisma.testPlan.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

/** POST /api/dashboard/collections/[suites|test-plans] */
export async function POST(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { kind } = await params;
  if (!isKind(kind)) return jsonError("Unknown collection.", 404);

  const parsed = collectionSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, description, schedule, module, environment, platform, labels, prerequisites, testCaseIds, suiteIds, browsers, settings } =
    parsed.data;

  await delay(MOCK_LATENCY_MS / 2);

  if (kind === "suites") {
    const caseIds = [...new Set(testCaseIds ?? [])];
    const cases = caseIds.length
      ? await prisma.testCase.findMany({
          where: { organisationId: ctx.org.id, id: { in: caseIds } },
          select: { id: true },
        })
      : [];
    const item = await prisma.testSuite.create({
      data: {
        organisationId: ctx.org.id,
        name,
        description: description || null,
        schedule,
        module,
        platform: platform ?? "Web",
        labelsJson: JSON.stringify(labels ?? []),
        prerequisitesJson: JSON.stringify(prerequisites ?? []),
        testCasesCount: cases.length,
        testCases: cases.length ? { connect: cases.map((c) => ({ id: c.id })) } : undefined,
      },
    });
    await audit(prisma, ctx, "test_suite.created", name);
    return NextResponse.json({ item }, { status: 201 });
  }

  const selectedSuites = suiteIds?.length
    ? await prisma.testSuite.findMany({
        where: { organisationId: ctx.org.id, id: { in: [...new Set(suiteIds)] } },
        include: { testCases: { select: { id: true } } },
      })
    : [];
  const caseIds = [...new Set(selectedSuites.flatMap((suite) => suite.testCases.map((c) => c.id)))];
  const cases = caseIds.length
    ? await prisma.testCase.findMany({ where: { organisationId: ctx.org.id, id: { in: caseIds } }, select: { id: true } })
    : [];
  const settingsJson = JSON.stringify({
    ...(settings ?? {}),
    ...(labels ? { labels } : {}),
    ...(browsers ? { browsers } : {}),
    ...(selectedSuites.length ? { suiteIds: selectedSuites.map((suite) => suite.id) } : {}),
  });
  const item = await prisma.testPlan.create({
    data: {
      organisationId: ctx.org.id,
      name,
      description: description || null,
      schedule,
      module,
      environment: environment || null,
      browsersJson: JSON.stringify(browsers?.length ? browsers : ["Chromium"]),
      settingsJson,
      testCasesCount: cases.length,
      testCases: cases.length ? { connect: cases.map((c) => ({ id: c.id })) } : undefined,
      suites: selectedSuites.length ? { connect: selectedSuites.map((suite) => ({ id: suite.id })) } : undefined,
    },
  });
  await audit(prisma, ctx, "test_plan.created", name);
  return NextResponse.json({ item }, { status: 201 });
}
