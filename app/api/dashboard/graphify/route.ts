import { NextResponse } from "next/server";
import { loadGraphifyMap } from "@/lib/graphify";
import { guardAnyPermission } from "@/lib/rbac-server";

/** GET /api/dashboard/graphify?crawlId= — URLs, DOM, requirements, tests and PRs. */
export async function GET(request: Request) {
  const guard = await guardAnyPermission(["crawl", "codeAnalysis", "testCases"]);
  if (!guard.ok) return guard.response;
  const url = new URL(request.url);
  const crawlId = url.searchParams.get("crawlId") ?? undefined;
  const data = await loadGraphifyMap(guard.ctx.org.id, { crawlId });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
