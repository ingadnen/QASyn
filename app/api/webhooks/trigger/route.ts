import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { resolveOrgForMcp } from "@/lib/api-token-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit } from "@/lib/tenant";
import { z } from "zod";

const schema = z.object({ testPlanId: z.string().min(1).max(60), triggeredBy: z.enum(["manual", "schedule", "ci"]).default("ci") });

/** POST /api/webhooks/trigger — inbound CI/CD trigger (API token auth). */
export async function POST(request: Request) {
  const auth = await resolveOrgForMcp(request);
  if (!auth) return jsonError("Unauthorized. Missing or invalid API token.", 401);
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { testPlanId, triggeredBy } = parsed.data;
  const plan = await prisma.testPlan.findFirst({ where: { id: testPlanId, organisationId: auth.organisationId } });
  if (!plan) return jsonError("Test plan not found in this organisation.", 404);
  const execution = await prisma.testPlanExecution.create({
    data: { organisationId: auth.organisationId, testPlanId: plan.id, status: "PENDING", triggeredBy },
  });
  await audit(prisma, { org: { id: auth.organisationId } as never, user: { email: "webhook" } as never }, "webhook.trigger", `${plan.name} · ${triggeredBy}`);
  return NextResponse.json({ executionId: execution.id, status: execution.status }, { status: 201 });
}
