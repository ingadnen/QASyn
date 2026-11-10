import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { completeCrawl, reimportCrawl } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { crawlActionSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** GET /api/dashboard/crawl/[id] — one crawl with its generated requirement. */
export async function GET(_request: Request, { params }: Params) {
  const guard = await guardPermission("crawl");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const crawl = await prisma.crawlSession.findFirst({
    where: { id, organisationId: guard.ctx.org.id },
    include: { project: { select: { name: true } } },
  });
  if (!crawl) return jsonError("Crawl not found.", 404);
  return NextResponse.json({ crawl });
}

/** PATCH /api/dashboard/crawl/[id] { action: "complete" | "cancel" | "reimport" } */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await guardPermission("crawlRun", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const parsed = crawlActionSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const crawl = await prisma.crawlSession.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!crawl) return jsonError("Crawl not found.", 404);

  if (parsed.data.action === "reimport") {
    await delay(MOCK_LATENCY_MS * 2);
    const result = await prisma.$transaction((tx) => reimportCrawl(tx, ctx, crawl));
    const updated = await prisma.crawlSession.findFirst({ where: { id: crawl.id }, select: { status: true, completedAt: true } });
    return NextResponse.json({ status: updated?.status ?? "completed", ...result });
  }

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

/** DELETE /api/dashboard/crawl/[id] — removes the crawl session (generated cases are preserved). */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardPermission("crawlRun", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const crawl = await prisma.crawlSession.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!crawl) return jsonError("Crawl not found.", 404);
  await prisma.crawlSession.delete({ where: { id: crawl.id } });
  await audit(prisma, ctx, "crawl.deleted", crawl.targetUrl);
  return NextResponse.json({ ok: true, id: crawl.id });
}
