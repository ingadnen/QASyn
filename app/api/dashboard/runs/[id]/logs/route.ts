import { NextResponse } from "next/server";
import { resolveDashboardOrg, serializeLog, serializeRun } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/dashboard/runs/:id/logs — lignes du terminal AQE pour un run.
 * Le run doit appartenir à l'organisation affichée (pas d'accès inter-organisations).
 */
export async function GET(_request: Request, context: RouteContext) {
  const dashboard = await resolveDashboardOrg();
  if (!dashboard) return jsonError("No dashboard data. Run `npm run db:seed`.", 404);

  const { id } = await context.params;
  const run = await prisma.testRun.findFirst({
    where: { id, organisationId: dashboard.org.id },
    include: { logs: { orderBy: { timestamp: "asc" } } },
  });
  if (!run) return jsonError("Run not found.", 404);

  const { logs, ...rest } = run;
  return NextResponse.json(
    { run: serializeRun(rest), logs: logs.map(serializeLog) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
