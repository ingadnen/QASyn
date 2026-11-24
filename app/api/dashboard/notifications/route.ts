import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { guardApi } from "@/lib/tenant";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark-read"), id: z.string().min(1).max(64) }),
  z.object({ action: z.literal("mark-all-read") }),
]);

/** GET /api/dashboard/notifications — in-app feed for the topbar bell. */
export async function GET(request: Request) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "1";
  const eventType = url.searchParams.get("eventType");

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: {
        organisationId: guard.ctx.org.id,
        ...(unreadOnly ? { readAt: null } : {}),
        ...(eventType ? { eventType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { organisationId: guard.ctx.org.id, readAt: null } }),
  ]);

  return NextResponse.json({ notifications, unread });
}

/** POST /api/dashboard/notifications — mark one/all as read. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.action === "mark-all-read") {
    await prisma.notification.updateMany({
      where: { organisationId: guard.ctx.org.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else {
    await prisma.notification.updateMany({
      where: { id: parsed.data.id, organisationId: guard.ctx.org.id, readAt: null },
      data: { readAt: new Date() },
    });
  }
  const unread = await prisma.notification.count({
    where: { organisationId: guard.ctx.org.id, readAt: null },
  });
  return NextResponse.json({ ok: true, unread });
}
