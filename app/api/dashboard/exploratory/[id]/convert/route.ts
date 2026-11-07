import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };
const schema = z.object({ convert: z.literal(true) });

/** POST /api/dashboard/exploratory/[id]/convert — convert captured actions to an NLP test case. */
export async function POST(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const session = await prisma.exploratorySession.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!session) return jsonError("Session not found.", 404);
  let actions: Array<{ kind: string; target: string; value?: string }> = [];
  try {
    actions = JSON.parse(session.actionsJson || "[]");
  } catch {
    actions = [];
  }
  const { actionsToNlpSteps } = await import("@/lib/exploratory-capture");
  const steps = actionsToNlpSteps(actions);
  if (steps.length === 0) return jsonError("Session has no actions to convert.", 400);
  const testCase = await prisma.testCase.create({
    data: {
      organisationId: ctx.org.id,
      title: `Exploratory: ${new Date(session.startedAt).toLocaleString()}`,
      module: "Core",
      criticality: "medium",
      status: "draft",
      stepsCount: steps.length,
      source: "manual",
      stepsJson: JSON.stringify(steps),
    },
  });
  await prisma.exploratorySession.update({ where: { id: session.id }, data: { status: "converted", convertedCaseId: testCase.id } });
  await audit(prisma, ctx, "exploratory.converted", `${steps.length} steps → ${testCase.title}`);
  return NextResponse.json({ testCase });
}
