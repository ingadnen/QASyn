import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOrgForMcp } from "@/lib/api-token-auth";
import { ensureWal } from "@/lib/db";
import { jsonError, readJson } from "@/lib/http";
import { callMcpTool, QASYN_MCP_TOOLS } from "@/lib/mcp-server";
import { quotaErrorResponse } from "@/lib/tenant";

const rpcSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().max(64), z.number()]).optional(),
  method: z.string().min(1).max(60),
  params: z.object({ name: z.string().max(80).optional(), arguments: z.record(z.string(), z.unknown()).optional() }).passthrough().optional(),
});

/**
 * GET /api/mcp/sse — MCP SSE transport: opens a stream, advertises the
 * message endpoint and keeps the connection alive with pings.
 */
export async function GET(request: Request) {
  const auth = await resolveOrgForMcp(request);
  if (!auth) return jsonError("Unauthorized. Missing or invalid API token.", 401);
  void ensureWal();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      send("endpoint", "/api/mcp/sse");
      send("ping", new Date().toISOString());
      const ping = setInterval(() => send("ping", new Date().toISOString()), 25_000);
      request.signal.addEventListener("abort", () => {
        clearInterval(ping);
        controller.close();
      });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}

/**
 * POST /api/mcp/sse — JSON-RPC MCP: initialize, tools/list, tools/call.
 * Auth: Bearer cqa_… API token (organisation-scoped) or dashboard session.
 */
export async function POST(request: Request) {
  const auth = await resolveOrgForMcp(request);
  if (!auth) return jsonError("Unauthorized. Missing or invalid API token.", 401);
  void ensureWal();

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
  if (method === "tools/list") {
    return NextResponse.json({ jsonrpc: "2.0", id, result: { tools: QASYN_MCP_TOOLS } });
  }
  if (method === "tools/call") {
    if (!params?.name) return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } });
    if (!QASYN_MCP_TOOLS.some((t) => t.name === params.name)) {
      return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${params.name}` } });
    }
    try {
      const data = await callMcpTool(auth.organisationId, params.name, (params.arguments ?? {}) as Record<string, unknown>);
      return NextResponse.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data) }] } });
    } catch (e) {
      const quota = quotaErrorResponse(e);
      if (quota) return quota;
      return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32000, message: e instanceof Error ? e.message : "Tool execution failed" } });
    }
  }
  if (method === "notifications/initialized") return new Response(null, { status: 202 });
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
}
