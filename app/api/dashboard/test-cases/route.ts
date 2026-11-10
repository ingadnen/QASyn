import { NextResponse } from "next/server";
import { CREDIT_COSTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { buildStepsJson, generateTitles, resolveTargetUrl } from "@/lib/engine";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, spendCredits } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { createTestCaseSchema } from "@/lib/validation";

export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const testCases = await prisma.testCase.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ testCases });
}

/** POST /api/dashboard/test-cases — manual creation or (simulated) AI generation. */
export async function POST(request: Request) {
  const guard = await guardPermission("testCasesEdit", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = createTestCaseSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const targetUrl = resolveTargetUrl(input.targetUrl, ctx.org.website);
  await delay(input.mode === "ai" ? MOCK_LATENCY_MS * 2 : MOCK_LATENCY_MS);

  const created = await prisma.$transaction(async (tx) => {
    if (input.mode === "manual") {
      const tc = await tx.testCase.create({
        data: {
          organisationId: ctx.org.id,
          title: input.title,
          module: input.module,
          criticality: input.criticality,
          stepsCount: input.stepsCount,
          source: "manual",
          stepsJson: buildStepsJson(targetUrl, input.stepsCount, input.module, input.title),
          variablesJson: JSON.stringify({ url: targetUrl }),
        },
      });
      await audit(tx, ctx, "test_case.created", tc.title);
      return [tc];
    }
    const existing = new Set(
      (await tx.testCase.findMany({ where: { organisationId: ctx.org.id, module: input.module }, select: { title: true } })).map((t) => t.title),
    );
    const titles = generateTitles(input.module, input.prompt, input.count).filter((t) => !existing.has(t));
    const rows = [];
    for (const title of titles) {
      const stepsCount = 3 + (title.length % 5);
      rows.push(
        await tx.testCase.create({
          data: {
            organisationId: ctx.org.id,
            title,
            module: input.module,
            criticality: input.criticality,
            stepsCount,
            source: "ai",
            stepsJson: buildStepsJson(targetUrl, stepsCount, input.module, title),
            variablesJson: JSON.stringify({ url: targetUrl }),
          },
        }),
      );
    }
    await spendCredits(tx, ctx.org.id, CREDIT_COSTS.aiGeneration);
    await audit(tx, ctx, "test_case.generated", `${rows.length} × ${input.module}`);
    return rows;
  });

  return NextResponse.json({ created: created.length, testCases: created }, { status: 201 });
}
