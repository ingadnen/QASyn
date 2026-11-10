import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { requirementSchema } from "@/lib/validation";

export async function GET() {
  const guard = await guardPermission("requirements");
  if (!guard.ok) return guard.response;
  const requirements = await prisma.requirement.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { code: "asc" } });
  return NextResponse.json({ requirements });
}

export async function POST(request: Request) {
  const guard = await guardPermission("requirementsEdit", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = requirementSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  await delay(MOCK_LATENCY_MS / 2);
  try {
    const requirement = await prisma.requirement.create({ data: { organisationId: ctx.org.id, ...parsed.data } });
    await audit(prisma, ctx, "requirement.created", `${requirement.code} ${requirement.title}`);
    return NextResponse.json({ requirement }, { status: 201 });
  } catch (e) {
    if ((e as Prisma.PrismaClientKnownRequestError).code === "P2002") return jsonError(`${parsed.data.code} already exists.`, 409);
    throw e;
  }
}
