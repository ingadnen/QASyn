import { NextResponse } from "next/server";
import { z } from "zod";
import { sha256 } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";
import { MCP_TOOLS, runMcpTool } from "@/lib/mcp";
import { rateLimit } from "@/lib/rate-limit";

const rpcSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().max(64), z.number()]),
  method: z.enum(["tools/list", "tools/call"]),
  params: z.object({ name: z.enum(MCP_TOOLS.map((t) => t.name) as [string, ...string[]]) }).optional(),
});

/**
 * POST /api/mcp — minimal JSON-RPC MCP endpoint (tools/list, tools/call), read-only.
 * Auth: "Authorization: Bearer cqa_…" (API token of the organisation; only its SHA-256 is stored).
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = /^Bearer (cqa_[A-Za-z0-9_-]{20,64})$/.exec(auth)?.[1];
  if (!token) return jsonError("Missing or malformed API token.", 401);

  const record = await prisma.apiToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record) return jsonError("Invalid API token.", 401);
  if (!rateLimit(`mcp:${record.id}`, 60, 60_000)) return jsonError("Too many requests.", 429);

  const parsed = rpcSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, { status: 400 });
  }
  const { id, method, params } = parsed.data;
  await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });

  if (method === "tools/list") {
    return NextResponse.json({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS.map((t) => ({ ...t, inputSchema: { type: "object", properties: {} } })) } });
  }
  if (!params) return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } }, { status: 400 });
  const data = await runMcpTool(record.organisationId, params.name as (typeof MCP_TOOLS)[number]["name"]);
  return NextResponse.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }] } });
}
