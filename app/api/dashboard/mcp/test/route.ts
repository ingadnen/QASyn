import { NextResponse } from "next/server";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { runMcpTool } from "@/lib/mcp";
import { guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { mcpTestSchema } from "@/lib/validation";

/** POST /api/dashboard/mcp/test { tool } — runs an MCP tool from the dashboard (session auth). */
export async function POST(request: Request) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const parsed = mcpTestSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  await delay(MOCK_LATENCY_MS / 2);
  const result = await runMcpTool(guard.ctx.org.id, parsed.data.tool);
  return NextResponse.json({ tool: parsed.data.tool, result });
}
