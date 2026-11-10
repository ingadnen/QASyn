import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOrgForMcp } from "@/lib/api-token-auth";
import { jsonError, readJson } from "@/lib/http";
import { callMcpTool, QASYN_MCP_TOOLS } from "@/lib/mcp-server";
import { rateLimit } from "@/lib/rate-limit";

const rpcSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().max(64), z.number()]).optional(),
  method: z.string().min(1).max(60),
  params: z
    .object({ name: z.string().max(80).optional(), arguments: z.record(z.string(), z.unknown()).optional() })
    .passthrough()
    .optional(),
});

/** GET /api/mcp — discovery document for MCP clients that probe the endpoint. */
export async function GET() {
  return NextResponse.json({
    name: "qasyn-mcp",
    version: "1.0.0",
    protocolVersion: "2024-11-05",
    transport: { sse: "/api/mcp/sse", jsonrpc: "/api/mcp" },
    tools: QASYN_MCP_TOOLS.map((tool) => tool.name),
  });
}

/**
 * POST /api/mcp — Streamable/JSON-RPC MCP endpoint.
 * Auth: "Authorization: Bearer cqa_…" or "?token=cqa_…" (token of the organisation;
 * only its SHA-256 is stored). Falls back to the dashboard session.
 */
export async function POST(request: Request) {
  const auth = await resolveOrgForMcp(request);
  if (!auth) return jsonError("Unauthorized. Missing or invalid API token.", 401);
  if (!rateLimit(`mcp:${auth.organisationId}`, 120, 60_000)) return jsonError("Too many requests.", 429);

  const parsed = rpcSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, { status: 400 });
  }
  const { id, method, params } = parsed.data;

  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "qasyn-mcp", version: "1.0.0" },
        capabilities: { tools: {} },
      },
    });
  }
  if (method === "notifications/initialized" || method === "ping") {
    return new Response(null, { status: 202 });
  }
  if (method === "tools/list") {
    return NextResponse.json({ jsonrpc: "2.0", id, result: { tools: QASYN_MCP_TOOLS } });
  }
  if (method === "tools/call") {
    if (!params?.name) return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } }, { status: 400 });
    if (!QASYN_MCP_TOOLS.some((tool) => tool.name === params.name)) {
      return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${params.name}` } });
    }
    try {
      const data = await callMcpTool(auth.organisationId, params.name, (params.arguments ?? {}) as Record<string, unknown>);
      return NextResponse.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] } });
    } catch (error) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: error instanceof Error ? error.message : "Tool execution failed" },
      });
    }
  }
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
}
