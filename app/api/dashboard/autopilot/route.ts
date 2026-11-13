import { NextResponse } from "next/server";
import { z } from "zod";
import { runQualityAutopilot } from "@/lib/autopilot";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { guardPermission } from "@/lib/rbac-server";
import { audit, quotaErrorResponse } from "@/lib/tenant";
import { normalizeWebsite } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const autopilotSchema = z.object({
  targetUrl: z.string().trim().min(4).max(300),
});

/**
 * POST /api/dashboard/autopilot { targetUrl }
 * Runs the five Quality Autopilot phases: live crawl, Strix scan, Graphify,
 * Bivia-calibrated authoring and immediate Studio execution.
 */
export async function POST(request: Request) {
  const guard = await guardPermission("crawlRun", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = autopilotSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const targetUrl = normalizeWebsite(parsed.data.targetUrl);
  if (!targetUrl) {
    return jsonError("Enter a public URL, e.g. https://www.cgi.com", 400);
  }

  try {
    const result = await runQualityAutopilot(prisma, ctx, targetUrl);
    await audit(
      prisma,
      ctx,
      "autopilot.completed",
      `${targetUrl} · ${result.testCases.length} test case(s) · ${result.security.grade} security grade · ${result.execution.passed}/${result.execution.total} passed`,
    );

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const quota = quotaErrorResponse(error);
    if (quota) return quota;
    throw error;
  }
}
