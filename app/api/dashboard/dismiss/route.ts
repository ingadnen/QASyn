import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi, readSettings, writeSettings } from "@/lib/tenant";
import { dismissSchema } from "@/lib/validation";

/** POST /api/dashboard/dismiss { card, slackChannel? } — hides an Overview card (per organisation). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = dismissSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { card, slackChannel } = parsed.data;

  const current = readSettings(ctx.org);
  const dismissed = Array.from(new Set([...(current.dismissed ?? []), card]));
  const settings = await writeSettings(prisma, ctx.org, {
    dismissed,
    ...(slackChannel ? { slackChannelCreated: true } : {}),
  });
  await audit(prisma, ctx, slackChannel ? "slack.channel_created" : "overview.card_dismissed", slackChannel ? `#qasyn-${ctx.org.slug}` : card);
  return NextResponse.json({ settings });
}
