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
  const { name, description, schedule, module, environment } = parsed.data;

  const testCasesCount = await prisma.testCase.count({ where: { organisationId: ctx.org.id, ...(module ? { module } : {}) } });
  await delay(MOCK_LATENCY_MS / 2);
  const base = { organisationId: ctx.org.id, name, description: description || null, schedule, module, testCasesCount };
  const item =
    kind === "suites"
      ? await prisma.testSuite.create({ data: base })
      : await prisma.testPlan.create({ data: { ...base, environment: environment || null } });
  await audit(prisma, ctx, kind === "suites" ? "suite.created" : "test_plan.created", name);
  return NextResponse.json({ item }, { status: 201 });
}
