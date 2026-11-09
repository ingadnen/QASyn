import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startCrawl } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { guardApi } from "@/lib/tenant";
import { delay, normalizeWebsite } from "@/lib/utils";
import { startCrawlSchema } from "@/lib/validation";

/** GET /api/dashboard/crawl — crawl sessions of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const crawls = await prisma.crawlSession.findMany({
    where: { organisationId: guard.ctx.org.id },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: { id: true, targetUrl: true, status: true, pagesVisited: true, flowsMapped: true, startedAt: true, completedAt: true },
  });
  return NextResponse.json({ crawls });
}

/** POST /api/dashboard/crawl { targetUrl? } — starts a crawl (defaults to the organisation website). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = startCrawlSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const raw = parsed.data.targetUrl?.trim() || ctx.org.website || "";
  const targetUrl = raw ? normalizeWebsite(raw) : null;
  if (!targetUrl) return jsonError("Enter the URL of the app to crawl, e.g. https://staging.example.com", 400);

  const running = await prisma.crawlSession.findFirst({ where: { organisationId: ctx.org.id, status: "running" } });
  if (running) return jsonError("A crawl is already running. Complete it first.", 409, { crawlId: running.id });

  await delay(MOCK_LATENCY_MS);
  const crawl = await startCrawl(prisma, ctx, targetUrl, {
    platform: parsed.data.platform,
    publishMode: parsed.data.publishMode,
    testTypes: parsed.data.testTypes,
    prerequisites: parsed.data.prerequisites,
    explorePrompt: parsed.data.explorePrompt,
    additionalContext: parsed.data.additionalContext,
    requirementName: parsed.data.requirementName,
    createSuite: parsed.data.createSuite,
    createPlan: parsed.data.createPlan,
  });
  return NextResponse.json({ crawl: { id: crawl.id, status: crawl.status } }, { status: 201 });
}
