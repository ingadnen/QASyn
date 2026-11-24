import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { runSyncPass } from "@/lib/integration-sync-engine";
import { planEntitlements } from "@/lib/entitlements";

const schema = z.object({ provider: z.string().max(40).optional() });

/** GET /api/dashboard/integrations/sync-live — poll target for the live-sync badge. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const connected = await prisma.integration.findMany({
    where: { organisationId: guard.ctx.org.id, status: "CONNECTED" },
    select: { provider: true, updatedAt: true },
  });
  const lastNotification = await prisma.notification.findFirst({
    where: { organisationId: guard.ctx.org.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const entitlements = planEntitlements(guard.ctx.org.plan);
  return NextResponse.json({
    intervalSeconds: entitlements.syncIntervalSeconds,
    realtimeSync: entitlements.realtimeSync,
    connectedProviders: connected.map((integration) => integration.provider),
    connectedCount: connected.length,
    lastSyncAt: lastNotification?.createdAt ?? null,
  });
}

/** POST /api/dashboard/integrations/sync-live — "Sync All Now" (or a single provider). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await readJson(request).catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error);
  if (!planEntitlements(guard.ctx.org.plan).realtimeSync) {
    return jsonError("Real-time sync is not enabled on this plan.", 403);
  }
  const result = await runSyncPass(guard.ctx, { provider: parsed.data.provider });
  await audit(prisma, guard.ctx, "integration.sync", `${result.reports.length} provider(s) · ${result.newNotifications} new notification(s)`);
  return NextResponse.json(result);
}
