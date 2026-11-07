import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runTestCases } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { updateTestCaseSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/dashboard/test-cases/[id] { action: "run" | "set" | "edit" } */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const parsed = updateTestCaseSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const tc = await prisma.testCase.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!tc) return jsonError("Test case not found.", 404);
  const input = parsed.data;

  if (input.action === "run") {
    await delay(MOCK_LATENCY_MS * 2);
    const result = await prisma.$transaction((tx) => runTestCases(tx, ctx, [tc]));
    await audit(prisma, ctx, "test_case.run", `${tc.title} · ${result.failed ? "failing" : "passing"}`);
    return NextResponse.json(result);
  }

  await delay(MOCK_LATENCY_MS / 2);
  const data =
    input.action === "set"
      ? { status: input.status }
      : { title: input.title ?? tc.title, module: input.module ?? tc.module, criticality: input.criticality ?? tc.criticality };
  const updated = await prisma.testCase.update({ where: { id: tc.id }, data });
  await audit(prisma, ctx, input.action === "set" ? "test_case.status" : "test_case.updated", `${updated.title}${input.action === "set" ? ` → ${input.status}` : ""}`);
  return NextResponse.json({ testCase: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const tc = await prisma.testCase.findFirst({ where: { id, organisationId: ctx.org.id }, include: { requirements: { select: { id: true } } } });
  if (!tc) return jsonError("Test case not found.", 404);
  await prisma.testCase.delete({ where: { id: tc.id } });
  for (const r of tc.requirements) {
    const count = await prisma.testCase.count({ where: { requirements: { some: { id: r.id } } } });
    await prisma.requirement.update({
      where: { id: r.id },
      data: { linkedTestsCount: count, coverageStatus: count === 0 ? "uncovered" : count === 1 ? "partial" : "covered" },
    });
  }
  await audit(prisma, ctx, "test_case.deleted", tc.title);
  return NextResponse.json({ ok: true });
}
