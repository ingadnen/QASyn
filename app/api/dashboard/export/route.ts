import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { exportTestCase, type ExportFramework, type ExportLanguage } from "@/lib/code-export";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  testCaseIds: z.array(z.string().max(60)).min(1).max(20),
  framework: z.enum(["playwright", "selenium", "cypress", "webdriverio"]),
  language: z.enum(["typescript", "javascript", "python", "java"]).default("typescript"),
});

/** POST /api/dashboard/export — generate code files for the selected test cases. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { testCaseIds, framework, language } = parsed.data;
  const cases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id, id: { in: testCaseIds } } });
  if (cases.length === 0) return jsonError("No test cases found in this organisation.", 400);

  const files = cases.flatMap((tc) => {
    let steps: Array<{ id: string; action: string; target: string; value: string; selector: string }> = [];
    try {
      steps = JSON.parse(tc.stepsJson || "[]");
    } catch {
      steps = [];
    }
    if (steps.length === 0) steps = [{ id: tc.id, action: "Navigate", target: tc.title, value: "", selector: "" }];
    return exportTestCase({ title: tc.title }, steps as never, framework as ExportFramework, language as ExportLanguage);
  });
  await audit(prisma, ctx, "code_export", `${framework}/${language} · ${cases.length} cases · ${files.length} files`);
  return NextResponse.json({ files });
}
