import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

/** PATCH /api/dashboard/test-plans/[id] — configure browsers, environment and linked test cases. */
const schema = z.object({
  browsers: z.array(z.enum(["Chromium", "Firefox", "WebKit"])).max(3).optional(),
  environment: z.string().trim().max(60).optional(),
  testCaseIds: z.array(z.string().max(60)).max(200).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const plan = await prisma.testPlan.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!plan) return jsonError("Test plan not found.", 404);

  const data: Record<string, unknown> = {};
  if (parsed.data.browsers) data.browsersJson = JSON.stringify(parsed.data.browsers);
  if (parsed.data.environment !== undefined) data.environment = parsed.data.environment || null;
  if (parsed.data.testCaseIds) {
    const cases = await prisma.testCase.findMany({
      where: { organisationId: ctx.org.id, id: { in: parsed.data.testCaseIds } },
      select: { id: true },
    });
    data.testCasesCount = cases.length;
    const updated = await prisma.testPlan.update({
      where: { id: plan.id },
      data: { ...data, testCases: { set: cases.map((c) => ({ id: c.id })) } },
    });
    await audit(prisma, ctx, "test_plan.configured", `${plan.name} · ${cases.length} cases`);
    return NextResponse.json({ plan: updated });
  }
  const updated = await prisma.testPlan.update({ where: { id: plan.id }, data });
  await audit(prisma, ctx, "test_plan.configured", plan.name);
  return NextResponse.json({ plan: updated });
}
