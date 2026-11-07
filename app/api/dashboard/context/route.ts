import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const sourceSchema = z.object({
  type: z.enum(["JIRA_STORY", "SWAGGER_DOC", "FIGMA_LAYOUT", "RAW_URL", "VIDEO_LOG"]),
  sourceUrl: z.string().trim().min(1).max(2000),
  metadata: z.record(z.string(), z.unknown()).default({}),
  extractedText: z.string().max(20000).default(""),
});

/** GET /api/dashboard/context — sources, graph nodes and edges of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const [sources, nodes, edges] = await Promise.all([
    prisma.contextSource.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.contextGraphNode.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.contextGraphEdge.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return NextResponse.json({ sources, nodes, edges });
}

/** POST /api/dashboard/context — ingest a source and derive a graph node. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = sourceSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { type, sourceUrl, metadata, extractedText } = parsed.data;

  const source = await prisma.contextSource.create({
    data: { organisationId: ctx.org.id, type, sourceUrl, metadataJson: JSON.stringify(metadata), extractedText },
  });
  // Derive one graph node per source (entity = URL host or ticket key).
  const entityName = (() => {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return sourceUrl.slice(0, 60);
    }
  })();
  const node = await prisma.contextGraphNode.create({
    data: {
      organisationId: ctx.org.id,
      entityName,
      entityType: type === "JIRA_STORY" ? "requirement" : type === "SWAGGER_DOC" ? "api" : "flow",
      propertiesJson: JSON.stringify({ sourceId: source.id, type }),
    },
  });
  await audit(prisma, ctx, "context.ingested", `${type} · ${sourceUrl.slice(0, 80)}`);
  return NextResponse.json({ source, node }, { status: 201 });
}
