import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, writeSettings } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { bugReproSettingsSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bugReproSettingsSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  await delay(MOCK_LATENCY_MS / 2);
  const settings = await writeSettings(prisma, ctx.org, { bugReproduction: parsed.data });
  await audit(prisma, ctx, "settings.bug_reproduction_updated", parsed.data.autoReproduce ? "auto-reproduce on" : "auto-reproduce off");
  return NextResponse.json({ bugReproduction: settings.bugReproduction });
}
