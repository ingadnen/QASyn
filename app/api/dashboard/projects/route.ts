import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(""),
  type: z.enum(["web", "mobile", "api"]).default("web"),
  baseUrl: z.string().trim().max(2000).optional(),
});

/** GET /api/dashboard/projects — projects of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const projects = await prisma.project.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, include: { _count: { select: { testCases: true, testSuites: true, testPlans: true } } } });
  return NextResponse.json({ projects });
}

/** POST /api/dashboard/projects — create a project. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const project = await prisma.project.create({ data: { organisationId: ctx.org.id, ...parsed.data, baseUrl: parsed.data.baseUrl || null } });
  await audit(prisma, ctx, "project.created", project.name);
  return NextResponse.json({ project }, { status: 201 });
}
