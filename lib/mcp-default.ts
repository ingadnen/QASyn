import type { Organisation } from "@prisma/client";
import { decryptSecret, encryptSecret, generateApiToken, sha256 } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { readSettings, writeSettings } from "@/lib/tenant";

export interface DefaultMcpToken {
  token: string;
  record: { id: string; name: string; tokenPrefix: string; scopesJson: string; createdAt: Date; lastUsedAt: Date | null };
}

/**
 * Ensures the MCP page always has a real, selected cqa_ token.
 *
 * The secret is stored encrypted (AES-256-GCM via QASYN_SECRET) in the
 * organisation settings so it can be re-used across page loads without ever
 * storing plaintext. Revoking the token creates a fresh one on next visit.
 */
export async function ensureDefaultMcpToken(org: Pick<Organisation, "id" | "settingsJson">): Promise<DefaultMcpToken> {
  const settings = readSettings(org);
  const stored = settings.mcpDefaultToken;

  if (stored?.tokenId && stored.secret) {
    const token = decryptSecret(stored.secret);
    if (token) {
      const existing = await prisma.apiToken.findFirst({
        where: { id: stored.tokenId, organisationId: org.id, tokenHash: sha256(token) },
        select: { id: true, name: true, tokenPrefix: true, scopesJson: true, createdAt: true, lastUsedAt: true },
      });
      if (existing) return { token, record: existing };
    }
  }

  const count = await prisma.apiToken.count({ where: { organisationId: org.id } });
  if (count >= 10) {
    const oldest = await prisma.apiToken.findFirst({ where: { organisationId: org.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (oldest) await prisma.apiToken.delete({ where: { id: oldest.id } }).catch(() => undefined);
  }
  if (stored?.tokenId) {
    await prisma.apiToken.deleteMany({ where: { id: stored.tokenId, organisationId: org.id } }).catch(() => undefined);
  }

  const { token, prefix, hash } = generateApiToken();
  const record = await prisma.apiToken.create({
    data: {
      organisationId: org.id,
      name: "MCP · default",
      tokenPrefix: prefix,
      tokenHash: hash,
      scopesJson: JSON.stringify(["mcp:read", "mcp:run"]),
    },
    select: { id: true, name: true, tokenPrefix: true, scopesJson: true, createdAt: true, lastUsedAt: true },
  });
  await writeSettings(prisma, org, { mcpDefaultToken: { tokenId: record.id, secret: encryptSecret(token) } });
  return { token, record };
}
