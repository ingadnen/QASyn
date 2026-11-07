import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { apiTestSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };
const patchSchema = apiTestSchema.partial();

/** PATCH /api/dashboard/api-testing/[id] — update name/requests. */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const test = await prisma.apiTest.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!test) return jsonError("API test not found.", 404);
  const updated = await prisma.apiTest.update({
    where: { id: test.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
      ...(parsed.data.requests ? { requestsJson: JSON.stringify(parsed.data.requests) } : {}),
    },
  });
  await audit(prisma, ctx, "api_test.updated", updated.name);
  return NextResponse.json({ test: updated });
}

/** DELETE /api/dashboard/api-testing/[id] */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const { id } = await params;
  const test = await prisma.apiTest.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!test) return jsonError("API test not found.", 404);
  await prisma.apiTest.delete({ where: { id: test.id } });
  await audit(prisma, ctx, "api_test.deleted", test.name);
  return NextResponse.json({ ok: true });
}
