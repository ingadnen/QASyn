import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
  steps: z
    .array(
      z.object({
        id: z.string().max(40),
        action: z.string().max(60),
        target: z.string().max(200),
        value: z.string().max(500).default(""),
        selector: z.string().max(200).default(""),
      }),
    )
    .max(50)
    .optional(),
});

/** PATCH /api/dashboard/test-components/[id] — rename, re-describe or replace the step group. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const component = await prisma.testComponent.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!component) return jsonError("Step group not found.", 404);

  const updated = await prisma.testComponent.update({
    where: { id: component.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.steps !== undefined ? { stepsJson: JSON.stringify(parsed.data.steps) } : {}),
    },
  });
  await audit(prisma, ctx, "test_component.updated", updated.name);
  return NextResponse.json({ component: updated });
}

/** DELETE /api/dashboard/test-components/[id] */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const component = await prisma.testComponent.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!component) return jsonError("Step group not found.", 404);
  await prisma.testComponent.delete({ where: { id: component.id } });
  await audit(prisma, ctx, "test_component.deleted", component.name);
  return NextResponse.json({ ok: true, id: component.id });
}
