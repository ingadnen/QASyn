import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { testFolderSchema } from "@/lib/validation";

/** GET /api/dashboard/test-folders — modular folders of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const folders = await prisma.testFolder.findMany({
    where: { organisationId: guard.ctx.org.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { testCases: true } } },
  });
  return NextResponse.json({ folders });
}

/** POST /api/dashboard/test-folders — create a folder. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = testFolderSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const existing = await prisma.testFolder.findFirst({ where: { organisationId: ctx.org.id, name: parsed.data.name } });
  if (existing) return jsonError("A folder with this name already exists.", 409);

  const folder = await prisma.testFolder.create({ data: { organisationId: ctx.org.id, ...parsed.data } });
  await audit(prisma, ctx, "test_folder.created", folder.name);
  return NextResponse.json({ folder }, { status: 201 });
}
