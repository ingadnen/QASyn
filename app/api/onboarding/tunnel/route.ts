import { NextResponse } from "next/server";
import { generateTunnelToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardOwnOrg } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { tunnelActionSchema } from "@/lib/validation";

/**
 * POST /api/onboarding/tunnel { action: "rotate" | "enroll" | "disconnect", localPort? }
 * Simulated localhost tunnel. The full token is only ever returned to the owning organisation.
 */
export async function POST(request: Request) {
  const guard = await guardOwnOrg();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = tunnelActionSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { action, localPort } = parsed.data;

  const onboarding = await prisma.onboarding.findUnique({ where: { organisationId: ctx.org.id } });
  if (!onboarding) return jsonError("Onboarding not found.", 404);

  await delay(action === "enroll" ? MOCK_LATENCY_MS * 2 : MOCK_LATENCY_MS / 2);

  let data: { tunnelToken?: string; tunnelEnrolled: boolean; localPort?: number; reachMode?: string };
  switch (action) {
    case "rotate":
      data = { tunnelToken: generateTunnelToken(), tunnelEnrolled: false };
      break;
    case "enroll":
      data = {
        tunnelToken: onboarding.tunnelToken ?? generateTunnelToken(),
        tunnelEnrolled: true,
        localPort: localPort ?? onboarding.localPort ?? 3000,
        reachMode: "localhost",
      };
      break;
    case "disconnect":
      data = { tunnelEnrolled: false };
      break;
  }

  const updated = await prisma.onboarding.update({ where: { id: onboarding.id }, data });
  await audit(prisma, ctx, `tunnel.${action}`, `localhost:${updated.localPort ?? 3000}`);
  return NextResponse.json({
    tunnelToken: updated.tunnelToken,
    tunnelEnrolled: updated.tunnelEnrolled,
    localPort: updated.localPort ?? 3000,
  });
}
