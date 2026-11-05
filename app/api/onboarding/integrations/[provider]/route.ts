import { NextResponse } from "next/server";
import { PROVIDER_META } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { loadOnboardingState } from "@/lib/onboarding-state";
import { getCurrentOrgId } from "@/lib/session";
import { delay } from "@/lib/utils";
import { integrationBodySchema, providerSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ provider: string }> };

async function resolve(context: RouteContext) {
  const organisationId = await getCurrentOrgId();
  if (!organisationId) return { error: jsonError("No organisation in session.", 401) } as const;
  const { provider: raw } = await context.params;
  const provider = providerSchema.safeParse(raw.toUpperCase());
  if (!provider.success) return { error: jsonError("Unknown provider.", 404) } as const;
  return { organisationId, provider: provider.data } as const;
}

/**
 * POST /api/onboarding/integrations/github  { detail?: "owner/repo" }
 * Connexion simulée (UPSERT). GitHub / GitLab passent par INDEXING, puis
 * CONNECTED après quelques secondes (voir lib/onboarding-state.ts).
 */
export async function POST(request: Request, context: RouteContext) {
  const resolved = await resolve(context);
  if ("error" in resolved) return resolved.error;
  const { organisationId, provider } = resolved;

  const body = integrationBodySchema.safeParse((await readJson(request)) ?? {});
  if (!body.success) return validationError(body.error);

  await delay(MOCK_LATENCY_MS);

  const status = PROVIDER_META[provider].indexes ? "INDEXING" : "CONNECTED";
  const detail = body.data.detail || null;

  await prisma.integration.upsert({
    where: { organisationId_provider: { organisationId, provider } },
    create: { organisationId, provider, status, detail },
    update: { status, detail },
  });

  const state = await loadOnboardingState(organisationId);
  return NextResponse.json({ state });
}

/** DELETE /api/onboarding/integrations/github — déconnexion. */
export async function DELETE(_request: Request, context: RouteContext) {
  const resolved = await resolve(context);
  if ("error" in resolved) return resolved.error;
  const { organisationId, provider } = resolved;

  await prisma.integration.deleteMany({ where: { organisationId, provider } });

  const state = await loadOnboardingState(organisationId);
  return NextResponse.json({ state });
}
