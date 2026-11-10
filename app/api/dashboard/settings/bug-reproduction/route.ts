import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, writeSettings } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { bugReproductionSettingsSchema } from "@/lib/validation";

async function handle(request: Request) {
  const guard = await guardPermission("settingsManage", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bugReproductionSettingsSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  await delay(MOCK_LATENCY_MS / 2);
  const settings = await writeSettings(prisma, ctx.org, { bugReproductionSettings: parsed.data });
  await audit(prisma, ctx, "settings.bug_reproduction_updated", `${parsed.data.triggerMode} · ${parsed.data.triggerLabels.join(", ") || "no labels"}`);
  return NextResponse.json({ bugReproductionSettings: settings.bugReproductionSettings });
}

export const PUT = handle;
export const PATCH = handle;
export const POST = handle;
