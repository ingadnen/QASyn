import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AGENT_SKILLS,
  buildClaudeInstructions,
  buildCopilotInstructions,
  buildOpenCodeConfig,
  normalizeEnabledSkills,
} from "@/lib/agent-skills";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { guardPermission } from "@/lib/rbac-server";
import { readSettings, writeSettings } from "@/lib/tenant";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("toggle"), id: z.string().min(1).max(80), enabled: z.boolean() }),
  z.object({ action: z.literal("export"), target: z.enum(["claude", "copilot", "opencode"]), ids: z.array(z.string()).max(20).optional() }),
]);

/** GET /api/dashboard/agent-skills — catalogue + organisation selection. */
export async function GET() {
  const guard = await guardPermission("mcp");
  if (!guard.ok) return guard.response;
  const enabled = normalizeEnabledSkills(readSettings(guard.ctx.org).agentSkills);
  return NextResponse.json({ skills: AGENT_SKILLS, enabled });
}

/** POST /api/dashboard/agent-skills — toggle a skill or export agent instructions. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.action === "export") {
    const guard = await guardPermission("mcp");
    if (!guard.ok) return guard.response;
    const ids = normalizeEnabledSkills(parsed.data.ids ?? readSettings(guard.ctx.org).agentSkills);
    switch (parsed.data.target) {
      case "claude":
        return NextResponse.json({ filename: "CLAUDE.md", path: ".claude/CLAUDE.md", content: buildClaudeInstructions(ids) });
      case "copilot":
        return NextResponse.json({ filename: "copilot-instructions.md", path: ".github/copilot-instructions.md", content: buildCopilotInstructions(ids) });
      case "opencode":
        return NextResponse.json({ filename: "opencode.json", path: "opencode.json", content: buildOpenCodeConfig(ids) });
      default:
        return jsonError("Unsupported export target.", 400);
    }
  }

  const toggle = parsed.data;
  const guard = await guardPermission("mcpTokens", { write: true });
  if (!guard.ok) return guard.response;
  const current = normalizeEnabledSkills(readSettings(guard.ctx.org).agentSkills);
  const enabled = toggle.enabled
    ? Array.from(new Set([...current, toggle.id]))
    : current.filter((id) => id !== toggle.id);
  if (!AGENT_SKILLS.some((skill) => skill.id === toggle.id)) return jsonError("Unknown skill.", 404);
  const next = await writeSettings(prisma, guard.ctx.org, { agentSkills: enabled });
  return NextResponse.json({ enabled: normalizeEnabledSkills(next.agentSkills) });
}
