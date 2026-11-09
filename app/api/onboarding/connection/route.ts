import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { guardOwnOrg } from "@/lib/tenant";
import { delay, hostOf, normalizeWebsite } from "@/lib/utils";
import { connectionCheckSchema } from "@/lib/validation";

/**
 * POST /api/onboarding/connection — SIMULATED reachability check.
 * The server never contacts the URL (SSRF-safe): it only validates its shape
 * and, for localhost, checks that the tunnel agent has enrolled.
 */
export async function POST(request: Request) {
  const guard = await guardOwnOrg();
  if (!guard.ok) return guard.response;

  const parsed = connectionCheckSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  await delay(MOCK_LATENCY_MS + 400);

  if (parsed.data.reachMode === "staging") {
    const url = normalizeWebsite(parsed.data.environmentUrl);
    if (!url) return NextResponse.json({ ok: false, message: "Enter a valid URL, e.g. https://staging.your-domain.com" });
    const host = hostOf(url) ?? url;
    const latencyMs = 80 + (host.length * 37) % 220;
    return NextResponse.json({ ok: true, message: `Reached ${host} · HTTP 200 · ${latencyMs} ms`, url });
  }

  const onboarding = await prisma.onboarding.findUnique({ where: { organisationId: guard.ctx.org.id } });
  if (!onboarding?.tunnelEnrolled) {
    return NextResponse.json({ ok: false, message: "Waiting for a route — run the tunnel command on your machine." });
  }
  return NextResponse.json({ ok: true, message: `Route open to localhost:${parsed.data.localPort} through the tunnel.` });
}
