import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { LEARNING_MODULES } from "@/lib/learning";
import { audit, guardApi, readSettings, writeSettings } from "@/lib/tenant";

const schema = z.object({
  moduleId: z.string().max(60),
  status: z.enum(["in_progress", "completed"]),
});

const IDS = new Set(LEARNING_MODULES.map((m) => m.id));

/** GET /api/dashboard/learning/progress — progress of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ progress: readSettings(guard.ctx.org).learning ?? {} });
}

/** POST /api/dashboard/learning/progress { moduleId, status } — persists progress per organisation. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  if (!IDS.has(parsed.data.moduleId)) return jsonError("Unknown module.", 404);
  const settings = readSettings(guard.ctx.org);
  const learning = { ...(settings.learning ?? {}), [parsed.data.moduleId]: { status: parsed.data.status, updatedAt: new Date().toISOString() } };
  await writeSettings(prisma, guard.ctx.org, { learning });
  await audit(prisma, guard.ctx, "learning.progress", `${parsed.data.moduleId} → ${parsed.data.status}`);
  return NextResponse.json({ progress: learning });
}
