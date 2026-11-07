import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  temperament: z.enum(["frustrated", "confused", "impatient", "multilingual", "adversarial"]),
  language: z.string().trim().min(2).max(10).default("en"),
  behaviorRules: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  promptTemplate: z.string().trim().max(2000).default(""),
});

/** GET /api/dashboard/personas — personas of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const personas = await prisma.persona.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ personas });
}

/** POST /api/dashboard/personas — create a persona. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const persona = await prisma.persona.create({
    data: { ...parsed.data, organisationId: ctx.org.id, behaviorRules: JSON.stringify(parsed.data.behaviorRules) },
  });
  await audit(prisma, ctx, "persona.created", persona.name);
  return NextResponse.json({ persona }, { status: 201 });
}
