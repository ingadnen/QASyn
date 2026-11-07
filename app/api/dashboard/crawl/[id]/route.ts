import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { completeCrawl } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { crawlActionSchema } from "@/lib/validation";

/** PATCH /api/dashboard/crawl/[id] { action: "complete" | "cancel" } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const parsed = crawlActionSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const crawl = await prisma.crawlSession.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!crawl) return jsonError("Crawl not found.", 404);
  if (crawl.status !== "running") return jsonError("This crawl is not running.", 409);

  await delay(MOCK_LATENCY_MS * 2);
  if (parsed.data.action === "cancel") {
    await prisma.crawlSession.update({ where: { id: crawl.id }, data: { status: "failed", completedAt: new Date() } });
    await audit(prisma, ctx, "crawl.cancelled", crawl.targetUrl);
    return NextResponse.json({ status: "failed" });
  }
  const result = await prisma.$transaction((tx) => completeCrawl(tx, ctx, crawl));
  return NextResponse.json({ status: "completed", ...result });
}
