import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi, writeSettings } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { organizationPreferencesSchema } from "@/lib/validation";

/** PATCH /api/dashboard/settings/organization/preferences — all Organization Setting cards except company identity. */
export async function PATCH(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = organizationPreferencesSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  await delay(MOCK_LATENCY_MS / 3);
  const settings = await writeSettings(prisma, ctx.org, { organization: parsed.data });
  await audit(prisma, ctx, "settings.organization_updated", `${parsed.data.defaultBrowser} · ${parsed.data.timeZone} · ${parsed.data.defaultAiAction}`);
  return NextResponse.json({ organization: settings.organization });
}
