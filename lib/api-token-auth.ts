import { sha256 } from "./crypto";
import { prisma, ensureWal } from "./db";
import { getSession } from "./auth";

/**
 * Resolves the organisation for an external MCP agent:
 * 1) Bearer API token (cqa_…), only its SHA-256 is stored;
 * 2) falls back to the session cookie (dashboard).
 * Returns null when unauthenticated. Never accepts an organisationId from the client.
 */
export async function resolveOrgForMcp(request: Request): Promise<{ organisationId: string; via: "token" | "session" } | null> {
  void ensureWal();
  const auth = request.headers.get("authorization") ?? "";
  const token = /^Bearer (cqa_[A-Za-z0-9_-]{20,64})$/.exec(auth)?.[1];
  if (token) {
    const record = await prisma.apiToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record) return null;
    await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return { organisationId: record.organisationId, via: "token" };
  }
  const session = await getSession();
  if (session?.user.organisationId) return { organisationId: session.user.organisationId, via: "session" };
  return null;
}
