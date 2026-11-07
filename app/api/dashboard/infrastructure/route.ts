import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { z } from "zod";

const schema = z.object({
  browserName: z.enum(["chromium", "firefox", "webkit", "edge"]),
  platform: z.enum(["linux", "windows", "macos", "android", "ios"]),
  version: z.string().trim().min(1).max(20),
  concurrencyCap: z.number().int().min(1).max(50).default(5),
});

/** GET /api/dashboard/infrastructure — grid nodes (org-scoped). */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const nodes = await prisma.infrastructureGridNode.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { browserName: "asc" } });
  return NextResponse.json({ nodes });
}

/** POST /api/dashboard/infrastructure — register a grid node. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const node = await prisma.infrastructureGridNode.create({
    data: { organisationId: ctx.org.id, ...parsed.data, status: "IDLE" },
  });
  await audit(prisma, ctx, "grid.node_registered", `${node.browserName} ${node.version} · ${node.platform}`);
  return NextResponse.json({ node }, { status: 201 });
}
