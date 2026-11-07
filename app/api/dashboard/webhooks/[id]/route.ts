import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };
const schema = z.object({ active: z.boolean().optional(), events: z.array(z.string().max(40)).optional() });

/** PATCH /api/dashboard/webhooks/[id] — activate/deactivate or change events. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const webhook = await prisma.webhook.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!webhook) return jsonError("Webhook not found.", 404);
  const updated = await prisma.webhook.update({
    where: { id: webhook.id },
    data: { ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}), ...(parsed.data.events ? { events: JSON.stringify(parsed.data.events) } : {}) },
  });
  await audit(prisma, ctx, "webhook.updated", updated.name);
  return NextResponse.json({ webhook: updated });
}

/** DELETE /api/dashboard/webhooks/[id] */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const webhook = await prisma.webhook.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!webhook) return jsonError("Webhook not found.", 404);
  await prisma.webhook.delete({ where: { id: webhook.id } });
  await audit(prisma, ctx, "webhook.deleted", webhook.name);
  return NextResponse.json({ ok: true });
}
