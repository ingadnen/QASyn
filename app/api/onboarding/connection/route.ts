import { NextResponse } from "next/server";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { getCurrentOrgId } from "@/lib/session";
import { delay, hostOf, normalizeWebsite } from "@/lib/utils";
import { connectionCheckSchema } from "@/lib/validation";

/**
 * POST /api/onboarding/connection — "Checking connection…"
 * Vérification SIMULÉE : aucune requête sortante n'est émise vers l'URL fournie
 * (évite toute SSRF). Seul le format est validé.
 */
export async function POST(request: Request) {
  if (!(await getCurrentOrgId())) return jsonError("No organisation in session.", 401);

  const parsed = connectionCheckSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  await delay(MOCK_LATENCY_MS);

  if (parsed.data.reachType === "TEAM_ENV") {
    const url = normalizeWebsite(parsed.data.environmentUrl);
    const host = hostOf(url);
    if (!url || !host) return jsonError("Enter a valid URL, e.g. https://staging.example.com", 400);
    return NextResponse.json({
      ok: true,
      target: host,
      latencyMs: 40 + ((host.length * 37) % 120),
      message: `Reachable · ${host}`,
      simulated: true,
    });
  }

  return NextResponse.json({
    ok: true,
    target: `localhost:${parsed.data.localPort}`,
    latencyMs: 12,
    message: `Tunnel connected · localhost:${parsed.data.localPort}`,
    simulated: true,
  });
}
