import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { getCurrentOrgId } from "@/lib/session";
import { generateTunnelToken } from "@/lib/tokens";

/**
 * POST /api/onboarding/tunnel-token — génère (ou régénère) le jeton du tunnel localhost.
 * `?rotate=1` force la génération d'un nouveau jeton.
 */
export async function POST(request: Request) {
  const organisationId = await getCurrentOrgId();
  if (!organisationId) return jsonError("No organisation in session.", 401);

  const rotate = new URL(request.url).searchParams.get("rotate") === "1";
  const onboarding = await prisma.onboarding.findUnique({ where: { organisationId } });
  if (!onboarding) return jsonError("Onboarding not found.", 404);

  if (onboarding.tunnelToken && !rotate) {
    return NextResponse.json({ token: onboarding.tunnelToken });
  }

  const token = generateTunnelToken();
  await prisma.onboarding.update({ where: { id: onboarding.id }, data: { tunnelToken: token } });
  return NextResponse.json({ token });
}
