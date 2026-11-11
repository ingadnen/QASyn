import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { McpConnect, type McpTokenRow } from "@/components/dashboard/pages/McpConnect";
import { normalizeEnabledSkills } from "@/lib/agent-skills";
import { prisma } from "@/lib/db";
import { ensureDefaultMcpToken } from "@/lib/mcp-default";
import { can } from "@/lib/rbac";
import { readSettings } from "@/lib/tenant";

export const metadata: Metadata = { title: "MCP" };
export const dynamic = "force-dynamic";

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export default async function McpPage() {
  const ctx = await requirePermission("mcp");
  let plainToken: string | null = null;
  if (can(ctx.user.role, "mcpTokens")) {
    try {
      plainToken = (await ensureDefaultMcpToken(ctx.org)).token;
    } catch {
      // A read-only replica or an exhausted token budget must not break the page.
      plainToken = null;
    }
  }

  const tokens = await prisma.apiToken.findMany({
    where: { organisationId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopesJson: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  const rows: McpTokenRow[] = tokens.map((token) => ({
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: parseList(token.scopesJson),
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
  }));

  const settings = readSettings(ctx.org);
  return (
    <McpConnect
      tokens={rows}
      role={ctx.user.role}
      initialPlainToken={plainToken}
      enabledSkills={normalizeEnabledSkills(settings.agentSkills)}
    />
  );
}
