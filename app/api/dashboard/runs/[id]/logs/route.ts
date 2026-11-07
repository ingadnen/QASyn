import { NextResponse } from "next/server";
import { serializeLog } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { guardApi } from "@/lib/tenant";

/** GET /api/dashboard/runs/[id]/logs — logs of a run of the displayed organisation only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const run = await prisma.testRun.findFirst({
    where: { id, organisationId: guard.ctx.org.id },
    include: { logs: { orderBy: { timestamp: "asc" } } },
  });
  if (!run) return jsonError("Run not found.", 404);
  return NextResponse.json({ logs: run.logs.map(serializeLog) });
}
