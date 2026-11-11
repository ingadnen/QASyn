import { NextResponse } from "next/server";
import { z } from "zod";
import { biviaGround } from "@/lib/bivia";
import { jsonError, readJson, validationError } from "@/lib/http";
import { guardPermission } from "@/lib/rbac-server";
import { readSettings } from "@/lib/tenant";
import { normalizeWebsite } from "@/lib/utils";
import { captureTargetScreenshot, inspectTargetDom } from "@/lib/web-executor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const groundSchema = z.object({
  targetUrl: z.string().trim().max(300).optional(),
  targetDescription: z.string().trim().min(2).max(300),
});

/**
 * POST /api/dashboard/bivia/ground
 * Grounds a natural-language target on the rendered page. Playwright captures
 * the screenshot + DOM when available; the deterministic Bivia fallback keeps
 * the overlay usable offline.
 */
export async function POST(request: Request) {
  const guard = await guardPermission("testCases");
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = groundSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const targetUrl =
    normalizeWebsite(parsed.data.targetUrl ?? "") ??
    normalizeWebsite(ctx.org.website ?? "") ??
    "https://www.cgi.com";

  let screenshotBase64: string | null = null;
  let domSummary = "";
  try {
    const capture = await captureTargetScreenshot(targetUrl);
    if (capture) {
      screenshotBase64 = capture.screenshotBase64;
      domSummary = capture.domSummary;
    }
  } catch {
    screenshotBase64 = null;
  }
  if (!domSummary) {
    try {
      // Playwright already attempted this URL for the screenshot; skip a second
      // headless Chromium launch and use the fast HTTP fetch fallback only.
      const snapshot = await inspectTargetDom(targetUrl, { skipBrowser: true });
      if (snapshot) {
        domSummary = JSON.stringify(snapshot).slice(0, 8_000);
      }
    } catch {
      domSummary = "";
    }
  }

  const analysisCode = readSettings(ctx.org).analysisCode ?? null;
  const result = await biviaGround({
    targetDescription: parsed.data.targetDescription,
    screenshotBase64,
    domSummary: domSummary || `Visual grounding for ${targetUrl}`,
    organisationId: ctx.org.id,
    sources: { analysisCode },
    mode: "fast",
  });
  if (result.status === "abstained" && result.width <= 0 && result.height <= 0) {
    return jsonError(result.abstainReason || "Bivia could not ground this target.", 422);
  }

  return NextResponse.json({
    targetUrl,
    targetDescription: parsed.data.targetDescription,
    screenshotBase64,
    screenshotCaptured: Boolean(screenshotBase64),
    domCaptured: Boolean(domSummary),
    result: {
      x: result.x,
      y: result.y,
      width: result.width,
      height: result.height,
      rawBox: result.rawBox,
      space: result.space,
      label: result.label ?? parsed.data.targetDescription,
      confidence: result.confidence,
      confidencePct: Math.round(result.confidence * 1000) / 10,
      status: result.status,
      provider: result.provider,
      latencyMs: result.latencyMs,
      abstainReason: result.abstainReason,
    },
  });
}
