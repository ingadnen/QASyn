import { NextResponse } from "next/server";
import { PROVIDER_META } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { integrationBodySchema, providerSchema } from "@/lib/validation";

type Params = { params: Promise<{ provider: string }> };

/**
 * POST /api/onboarding/integrations/:provider — simulated OAuth connection.
 * Code hosts go through INDEXING (→ CONNECTED after ~8 s, settled lazily on read).
 */
export async function POST(request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const provider = providerSchema.safeParse((await params).provider.toUpperCase());
  if (!provider.success) return jsonError("Unknown provider.", 404);
  const body = integrationBodySchema.safeParse((await readJson(request)) ?? {});
  if (!body.success) return validationError(body.error);

  await delay(MOCK_LATENCY_MS);
  const meta = PROVIDER_META[provider.data];
  const detail = body.data.detail || `${ctx.org.slug}${provider.data === "SLACK" ? "" : "/app"}`;
  const status = meta.indexes ? "INDEXING" : "CONNECTED";

  const integration = await prisma.integration.upsert({
    where: { organisationId_provider: { organisationId: ctx.org.id, provider: provider.data } },
    create: { organisationId: ctx.org.id, provider: provider.data, status, detail: provider.data === "SLACK" ? `#${ctx.org.slug}-qa` : detail },
    update: { status, detail: provider.data === "SLACK" ? `#${ctx.org.slug}-qa` : detail },
  });
  await audit(prisma, ctx, "integration.connected", meta.name);
  return NextResponse.json({
    integration: { provider: integration.provider, status: integration.status, detail: integration.detail },
  });
}

/** DELETE /api/onboarding/integrations/:provider — disconnects the provider. */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const provider = providerSchema.safeParse((await params).provider.toUpperCase());
  if (!provider.success) return jsonError("Unknown provider.", 404);
  await prisma.integration.deleteMany({ where: { organisationId: ctx.org.id, provider: provider.data } });
  await audit(prisma, ctx, "integration.disconnected", PROVIDER_META[provider.data].name);
  return NextResponse.json({ ok: true });
}
