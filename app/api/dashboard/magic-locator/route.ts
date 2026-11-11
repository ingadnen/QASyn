import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCalibratedMagicLocators } from "@/lib/magic-locator";
import { jsonError, readJson } from "@/lib/http";
import { guardPermission } from "@/lib/rbac-server";
import { readSettings } from "@/lib/tenant";

const schema = z.object({
  action: z.string().min(1).max(120),
  target: z.string().max(1000).default(""),
  value: z.string().max(1000).optional(),
  selector: z.string().max(1000).optional(),
});

/** POST /api/dashboard/magic-locator — generate, calibrate and score resilient locators. */
export async function POST(request: Request) {
  const guard = await guardPermission("testCases");
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Provide the step action and target.", 400);
  const analysisCode = readSettings(guard.ctx.org).analysisCode ?? null;
  const result = await generateCalibratedMagicLocators(parsed.data, {
    organisationId: guard.ctx.org.id,
    enabled: analysisCode?.biviaMagicLocator !== false,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
