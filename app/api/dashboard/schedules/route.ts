import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { nextFireTime, parseCron } from "@/lib/scheduler";

const schema = z.object({
  testPlanId: z.string().min(1).max(60),
  name: z.string().trim().min(2).max(80),
  cronExpression: z.string().trim().min(5).max(40),
  timezone: z.string().trim().min(1).max(40).default("UTC"),
  enabled: z.boolean().default(true),
});

/** GET /api/dashboard/schedules — schedules of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const schedules = await prisma.schedule.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ schedules });
}

/** POST /api/dashboard/schedules — create a schedule. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  if (!parseCron(parsed.data.cronExpression)) return jsonError("Invalid cron expression (5 fields: minute hour dom month dow).", 400);
  const plan = await prisma.testPlan.findFirst({ where: { id: parsed.data.testPlanId, organisationId: ctx.org.id } });
  if (!plan) return jsonError("Test plan not found in this organisation.", 400);
  const schedule = await prisma.schedule.create({
    data: { ...parsed.data, organisationId: ctx.org.id, nextFireAt: nextFireTime(parsed.data.cronExpression) },
  });
  await audit(prisma, ctx, "schedule.created", `${schedule.name} · ${schedule.cronExpression}`);
  return NextResponse.json({ schedule }, { status: 201 });
}
