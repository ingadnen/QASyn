import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { apiTestSchema } from "@/lib/validation";

/** GET /api/dashboard/api-testing — API tests of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const tests = await prisma.apiTest.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ tests });
}

/** POST /api/dashboard/api-testing — create an API test (request chain). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = apiTestSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, description, requests } = parsed.data;
  const test = await prisma.apiTest.create({
    data: { organisationId: ctx.org.id, name, description: description ?? null, requestsJson: JSON.stringify(requests) },
  });
  await audit(prisma, ctx, "api_test.created", `${name} · ${requests.length} requests`);
  return NextResponse.json({ test }, { status: 201 });
}
