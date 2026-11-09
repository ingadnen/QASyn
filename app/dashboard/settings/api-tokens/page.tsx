import type { Metadata } from "next";
import { ApiTokensList } from "@/components/dashboard/pages/ApiTokensList";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "API Tokens" };
export const dynamic = "force-dynamic";

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export default async function ApiTokensPage() {
  const ctx = await requireOrgContext();
  const tokens = await prisma.apiToken.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[20px] font-bold leading-7 text-[#101828]">API Tokens</h1>
        <p className="mt-2 max-w-4xl text-[13.5px] leading-5 text-[#4a5565]">
          Scoped, long-lived credentials for scripts and integrations. You only see tokens you created — each carries a fixed permission set, an expiry, and an optional IP allowlist.
        </p>
      </div>
      <ApiTokensList
        readOnly={ctx.readOnly}
        tokens={tokens.map((t) => ({
          id: t.id,
          name: t.name,
          prefix: t.tokenPrefix,
          scopes: parseList(t.scopesJson),
          expiresAt: t.expiresAt?.toISOString() ?? null,
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
          ipCount: parseList(t.ipAllowlistJson).length,
        }))}
      />
    </div>
  );
}
