import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, writeSettings } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { analysisSettingsSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = analysisSettingsSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  await delay(MOCK_LATENCY_MS / 2);
  const settings = await writeSettings(prisma, ctx.org, { analysis: parsed.data });
  await audit(prisma, ctx, "settings.analysis_updated", `threshold ${parsed.data.severityThreshold} · min coverage ${parsed.data.minCoverage}%`);
  return NextResponse.json({ analysis: settings.analysis });
}
