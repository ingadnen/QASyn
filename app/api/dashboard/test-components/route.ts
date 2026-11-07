import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  steps: z.array(z.object({ id: z.string().max(40), action: z.string().max(60), target: z.string().max(200), value: z.string().max(500).default(""), selector: z.string().max(200).default("") })).max(50).default([]),
});

/** GET /api/dashboard/test-components — reusable components of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const components = await prisma.testComponent.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ components });
}

/** POST /api/dashboard/test-components — create a component. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const component = await prisma.testComponent.create({
    data: { organisationId: ctx.org.id, name: parsed.data.name, description: parsed.data.description, stepsJson: JSON.stringify(parsed.data.steps) },
  });
  await audit(prisma, ctx, "test_component.created", component.name);
  return NextResponse.json({ component }, { status: 201 });
}

/** DELETE stub guard for symmetry. */
export async function DELETE() {
  return jsonError("Use the list route with an id in future versions.", 405);
}
