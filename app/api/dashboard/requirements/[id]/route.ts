import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { linkTestsSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/requirements/[id] { testCaseIds } — replaces the linked test cases. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const parsed = linkTestsSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const requirement = await prisma.requirement.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!requirement) return jsonError("Requirement not found.", 404);

  // Only test cases of the same organisation can be linked.
  const testCases = await prisma.testCase.findMany({
    where: { organisationId: ctx.org.id, id: { in: parsed.data.testCaseIds } },
    select: { id: true, status: true },
  });
  const passing = testCases.filter((t) => t.status === "passing").length;
  const coverageStatus = testCases.length === 0 ? "uncovered" : passing === testCases.length ? "covered" : "partial";

  await delay(MOCK_LATENCY_MS / 2);
  const updated = await prisma.requirement.update({
    where: { id: requirement.id },
    data: { testCases: { set: testCases.map((t) => ({ id: t.id })) }, linkedTestsCount: testCases.length, coverageStatus },
  });
  await audit(prisma, ctx, "requirement.linked", `${requirement.code} · ${testCases.length} test cases`);
  return NextResponse.json({ requirement: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;
  const requirement = await prisma.requirement.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!requirement) return jsonError("Requirement not found.", 404);
  await prisma.requirement.delete({ where: { id: requirement.id } });
  await audit(prisma, ctx, "requirement.deleted", requirement.code);
  return NextResponse.json({ ok: true });
}
