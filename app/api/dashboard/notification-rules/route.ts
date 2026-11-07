import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { matchesEvent } from "@/lib/notifications";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  channel: z.enum(["slack", "teams", "email"]),
  events: z.array(z.string().max(40)).max(20).default(["test.failed"]),
  config: z.record(z.string(), z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

/** GET /api/dashboard/notification-rules — rules of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const rules = await prisma.notificationRule.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ rules });
}

/** POST /api/dashboard/notification-rules — create a rule + test-match an event. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const rule = await prisma.notificationRule.create({
    data: { organisationId: ctx.org.id, channel: parsed.data.channel, events: JSON.stringify(parsed.data.events), configJson: JSON.stringify(parsed.data.config), enabled: parsed.data.enabled },
  });
  const matched = matchesEvent([{ channel: rule.channel, events: JSON.parse(rule.events), enabled: rule.enabled }], parsed.data.events[0] ?? "test.failed");
  await audit(prisma, ctx, "notification_rule.created", `${rule.channel} · ${matched.length ? "matches" : "no match"}`);
  return NextResponse.json({ rule }, { status: 201 });
}
