import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay, normalizeWebsite } from "@/lib/utils";
import { knowledgeSchema } from "@/lib/validation";

/** GET /api/dashboard/knowledge-base - list knowledge items of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const items = await prisma.knowledgeItem.findMany({
    where: { organisationId: guard.ctx.org.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ items });
}

/** POST /api/dashboard/knowledge-base — adds a source; indexing settles after a few seconds (simulated, no fetch). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = knowledgeSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  let { urlOrPath } = parsed.data;
  if (parsed.data.type === "website" || parsed.data.type === "openapi") {
    const normalized = normalizeWebsite(urlOrPath);
    if (!normalized && parsed.data.type === "website") return jsonError("Enter a valid website, e.g. https://docs.your-domain.com", 400);
    if (normalized) urlOrPath = normalized;
  }

  await delay(MOCK_LATENCY_MS / 2);
  const item = await prisma.knowledgeItem.create({
    data: { organisationId: ctx.org.id, title: parsed.data.title, type: parsed.data.type, urlOrPath, status: "indexing" },
  });
  await audit(prisma, ctx, "knowledge.added", item.title);
  return NextResponse.json({ item }, { status: 201 });
}
