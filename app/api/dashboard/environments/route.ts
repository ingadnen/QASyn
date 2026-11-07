import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { environmentSchema } from "@/lib/validation";

export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const environments = await prisma.environmentConfig.findMany({
    where: { organisationId: guard.ctx.org.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, baseUrl: true, authType: true, isDefault: true, createdAt: true },
  });
  return NextResponse.json({ environments });
}

export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = environmentSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { variables, isDefault, ...rest } = parsed.data;

  await delay(MOCK_LATENCY_MS / 2);
  const env = await prisma.$transaction(async (tx) => {
    const count = await tx.environmentConfig.count({ where: { organisationId: ctx.org.id } });
    const makeDefault = isDefault || count === 0;
    if (makeDefault) await tx.environmentConfig.updateMany({ where: { organisationId: ctx.org.id }, data: { isDefault: false } });
    const created = await tx.environmentConfig.create({
      data: { organisationId: ctx.org.id, ...rest, variablesJson: JSON.stringify(variables), isDefault: makeDefault },
    });
    await audit(tx, ctx, "environment.created", `${created.name} · ${created.baseUrl}`);
    return created;
  });
  return NextResponse.json({ environment: { id: env.id, name: env.name } }, { status: 201 });
}
