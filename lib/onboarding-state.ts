import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { Focus, IntegrationStatus, OnboardingState, OsKey, Provider, ReachType } from "./types";

/** Durée simulée de l'indexation d'un dépôt (INDEXING → CONNECTED). */
export const INDEXING_DURATION_MS = 8000;

const include = {
  onboarding: true,
  integrations: { orderBy: { connectedAt: "asc" } },
} satisfies Prisma.OrganisationInclude;

type OrganisationWithOnboarding = Prisma.OrganisationGetPayload<{ include: typeof include }>;

export function toOnboardingState(org: OrganisationWithOnboarding): OnboardingState {
  const ob = org.onboarding;
  return {
    organisation: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      ownerName: org.ownerName,
      website: org.website ?? "",
      addWebsiteToKb: org.addWebsiteToKb,
    },
    currentStep: ob?.currentStep ?? 1,
    appDescription: ob?.appDescription ?? "",
    reachType: (ob?.reachType as ReachType | null) ?? null,
    environmentUrl: ob?.environmentUrl ?? "",
    selectedOs: (ob?.selectedOs as OsKey | null) ?? null,
    localPort: ob?.localPort ?? 3000,
    tunnelToken: ob?.tunnelToken ?? null,
    focus: (ob?.focus as Focus | null) ?? null,
    teamInvites: ob?.teamInvites ? ob.teamInvites.split("\n").filter(Boolean) : [],
    integrations: org.integrations.map((i) => ({
      provider: i.provider as Provider,
      status: i.status as IntegrationStatus,
      detail: i.detail,
    })),
    completed: Boolean(ob?.completedAt),
  };
}

/**
 * Charge l'état d'onboarding (SELECT) et fait progresser les indexations
 * terminées (UPDATE INDEXING → CONNECTED après INDEXING_DURATION_MS).
 */
export async function loadOnboardingState(organisationId: string): Promise<OnboardingState | null> {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId }, include });
  if (!org) return null;

  const now = Date.now();
  const finished = org.integrations.filter(
    (i) => i.status === "INDEXING" && now - i.updatedAt.getTime() >= INDEXING_DURATION_MS,
  );
  if (finished.length > 0) {
    await prisma.integration.updateMany({
      where: { id: { in: finished.map((i) => i.id) } },
      data: { status: "CONNECTED" },
    });
    for (const integration of finished) integration.status = "CONNECTED";
  }

  return toOnboardingState(org);
}
