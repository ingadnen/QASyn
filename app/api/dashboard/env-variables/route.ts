import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  environmentId: z.string().min(1).max(60),
  key: z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]{0,60}$/, "Invalid variable key."),
  value: z.string().max(2000),
  isSecret: z.boolean().default(false),
});

/** GET /api/dashboard/env-variables?environmentId=… — variables (secrets masked). */
export async function GET(request: Request) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const environmentId = new URL(request.url).searchParams.get("environmentId") ?? "";
  if (!environmentId) return NextResponse.json({ variables: [] });
  const env = await prisma.environmentConfig.findFirst({ where: { id: environmentId, organisationId: guard.ctx.org.id } });
  if (!env) return NextResponse.json({ variables: [] });
  const variables = await prisma.environmentVariable.findMany({ where: { environmentId }, orderBy: { key: "asc" } });
  return NextResponse.json({ variables: variables.map((v) => ({ ...v, value: v.isSecret ? "••••" : v.value })) });
}

/** POST /api/dashboard/env-variables — upsert a variable. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { environmentId, key, value, isSecret } = parsed.data;
  const env = await prisma.environmentConfig.findFirst({ where: { id: environmentId, organisationId: ctx.org.id } });
  if (!env) return jsonError("Environment not found in this organisation.", 400);
  const variable = await prisma.environmentVariable.upsert({
    where: { environmentId_key: { environmentId, key } },
    create: { environmentId, key, value, isSecret },
    update: { value, isSecret },
  });
  await audit(prisma, ctx, "env_variable.upsert", `${env.name}.${key}`);
  return NextResponse.json({ variable: { ...variable, value: isSecret ? "••••" : value } }, { status: 201 });
}

/** DELETE /api/dashboard/env-variables?id={id} */
export async function DELETE(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return jsonError("id is required.", 400);
  const variable = await prisma.environmentVariable.findFirst({
    where: { id, environment: { organisationId: guard.ctx.org.id } },
  });
  if (!variable) return jsonError("Variable not found.", 404);
  await prisma.environmentVariable.delete({ where: { id: variable.id } });
  await audit(prisma, guard.ctx, "env_variable.deleted", variable.key);
  return NextResponse.json({ ok: true });
}
