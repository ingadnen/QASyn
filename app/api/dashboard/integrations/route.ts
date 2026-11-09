import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";

const PLUGIN_KEYS = [
  "JIRA",
  "SLACK",
  "CONTEXTQA_LAB",
  "LINEAR",
  "AZURE_DEVOPS",
  "AZURE_VAULT",
  "GITHUB",
  "GITLAB",
  "FIGMA",
  "FRESHRELEASE",
  "YOUTRACK",
  "MANTIS",
  "BACKLOG",
  "ZEPEL",
  "BUGZILLA",
  "TRELLO",
  "CLICKUP",
  "PRIVATE_GRID",
  "JENKINS",
  "CODESHIP",
] as const;

const bodySchema = z.object({
  provider: z.enum(PLUGIN_KEYS),
  connected: z.boolean(),
});

const NAMES: Record<string, string> = {
  JIRA: "Jira",
  SLACK: "Slack",
  CONTEXTQA_LAB: "ContextQA Lab",
  LINEAR: "Linear",
  AZURE_DEVOPS: "Azure DevOps Boards",
  AZURE_VAULT: "Azure Vault",
  GITHUB: "GitHub",
  GITLAB: "GitLab",
  FIGMA: "Figma",
  FRESHRELEASE: "Freshrelease",
  YOUTRACK: "YouTrack",
  MANTIS: "Mantis Bug Tracker",
  BACKLOG: "Backlog",
  ZEPEL: "Zepel",
  BUGZILLA: "BugZilla",
  TRELLO: "Trello",
  CLICKUP: "ClickUp",
  PRIVATE_GRID: "Private Grid",
  JENKINS: "Jenkins",
  CODESHIP: "CodeShip CI",
};

/** POST /api/dashboard/integrations — connect or disconnect a plugin tile. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { provider, connected } = parsed.data;

  if (!connected) {
    await prisma.integration.deleteMany({ where: { organisationId: ctx.org.id, provider } });
    await audit(prisma, ctx, "integration.disconnected", NAMES[provider] ?? provider);
    return NextResponse.json({ provider, connected: false });
  }

  const detail =
    provider === "SLACK"
      ? `#${ctx.org.slug}-qa`
      : provider === "GITHUB" || provider === "GITLAB"
        ? `${ctx.org.slug}/app`
        : provider === "JIRA"
          ? ctx.org.slug.toUpperCase()
          : null;

  await prisma.integration.upsert({
    where: { organisationId_provider: { organisationId: ctx.org.id, provider } },
    create: { organisationId: ctx.org.id, provider, status: "CONNECTED", detail },
    update: { status: "CONNECTED", detail },
  });
  await audit(prisma, ctx, "integration.connected", NAMES[provider] ?? provider);
  return NextResponse.json({ provider, connected: true });
}
