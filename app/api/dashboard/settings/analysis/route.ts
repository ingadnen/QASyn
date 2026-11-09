import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, writeSettings } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { analysisCodeSettingsSchema } from "@/lib/validation";

async function handle(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = analysisCodeSettingsSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  await delay(MOCK_LATENCY_MS / 2);
  const settings = await writeSettings(prisma, ctx.org, { analysisCode: parsed.data });
  await audit(prisma, ctx, "settings.analysis_updated", `${parsed.data.runMode} · ${parsed.data.baseBranches || "all branches"}`);
  return NextResponse.json({ analysisCode: settings.analysisCode });
}

export const PUT = handle;
export const PATCH = handle;
export const POST = handle;
