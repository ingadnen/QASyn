import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { simulateDelivery, signPayload } from "@/lib/webhook-dispatch";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().min(5).max(2000),
  events: z.array(z.string().max(40)).max(20).default(["test.completed"]),
  secret: z.string().max(200).optional(),
});

/** GET /api/dashboard/webhooks — webhooks of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const webhooks = await prisma.webhook.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ webhooks: webhooks.map((w) => ({ ...w, secret: w.secret ? "configured" : null })) });
}

/** POST /api/dashboard/webhooks — create + test delivery. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, url, events, secret } = parsed.data;
  const webhook = await prisma.webhook.create({
    data: { organisationId: ctx.org.id, name, url, events: JSON.stringify(events), secret: secret || null, lastDeliveredAt: new Date() },
  });
  const delivery = simulateDelivery(url, "ping");
  await audit(prisma, ctx, "webhook.created", `${name} · ${delivery.length} attempt(s)`);
  return NextResponse.json({ webhook, delivery }, { status: 201 });
}
