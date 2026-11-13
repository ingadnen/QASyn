import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseIntegrationConfig } from "@/lib/integration-providers";
import { discoverPullRequests } from "@/lib/pr-catalog";
import { guardApi } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/pull-requests/sources
 * Connected source-control providers, their repositories and open pull requests.
 */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;

  const integrations = await prisma.integration.findMany({
    where: {
      organisationId: guard.ctx.org.id,
      status: "CONNECTED",
      provider: { in: ["GITHUB", "GITLAB", "BITBUCKET", "AZURE_DEVOPS"] },
    },
    orderBy: { provider: "asc" },
  });

  const sources = (
    await discoverPullRequests(
      integrations.map((integration) => ({
        provider: integration.provider,
        status: integration.status,
        config: parseIntegrationConfig(integration.configJson),
      })),
    )
  ).map((source) => ({
    provider: source.provider,
    providerName: source.providerName,
    repositories: [
      {
        repository: source.repository,
        baseBranch: source.baseBranch,
        pullRequests: source.pullRequests,
      },
    ],
  }));

  return NextResponse.json({ sources });
}
