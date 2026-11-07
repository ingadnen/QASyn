import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { mobileTestSchema } from "@/lib/validation";

/** GET /api/dashboard/mobile/tests — mobile tests of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const tests = await prisma.mobileTest.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ tests });
}

/** POST /api/dashboard/mobile/tests — create a mobile test (device + gestures). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = mobileTestSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, appId, device, gestures } = parsed.data;
  if (appId) {
    const app = await prisma.mobileApp.findFirst({ where: { id: appId, organisationId: ctx.org.id } });
    if (!app) return jsonError("Mobile app not found.", 404);
  }
  const test = await prisma.mobileTest.create({
    data: { organisationId: ctx.org.id, name, appId: appId ?? null, device, gesturesJson: JSON.stringify(gestures) },
  });
  await audit(prisma, ctx, "mobile.test_created", `${name} · ${device}`);
  return NextResponse.json({ test }, { status: 201 });
}
