import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const actionSchema = z.object({ kind: z.string().max(40), target: z.string().max(200), value: z.string().max(500).default(""), ts: z.string().max(40).optional() });
const schema = z.object({ actions: z.array(actionSchema).max(100).default([]), notes: z.array(z.string().max(500)).max(20).default([]) });

/** GET /api/dashboard/exploratory — sessions of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const sessions = await prisma.exploratorySession.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { startedAt: "desc" }, take: 30 });
  return NextResponse.json({ sessions });
}

/** POST /api/dashboard/exploratory — start or append a session; action=convert creates a test case. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const session = await prisma.exploratorySession.create({
    data: { organisationId: ctx.org.id, userId: ctx.user.id, actionsJson: JSON.stringify(parsed.data.actions), notesJson: JSON.stringify(parsed.data.notes), status: "completed", endedAt: new Date() },
  });
  await audit(prisma, ctx, "exploratory.captured", `${parsed.data.actions.length} actions`);
  return NextResponse.json({ session }, { status: 201 });
}

/** PUT alias for capture updates. */
export async function PUT(request: Request) {
  return POST(request);
}
