import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type {
  AppLoginType, CrawlStatus, Focus, IntegrationStatus, OnboardingRole, OnboardingState, PainPoint, Provider, ReachMode,
  TestingMaturity,
} from "./types";

const include = {
  onboarding: true,
  integrations: { orderBy: { connectedAt: "asc" } },
  crawlSessions: { orderBy: { startedAt: "desc" }, take: 1 },
} satisfies Prisma.OrganisationInclude;

type OrganisationWithOnboarding = Prisma.OrganisationGetPayload<{ include: typeof include }>;

function parseList<T extends string>(json: string): T[] {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? (value.filter((v) => typeof v === "string") as T[]) : [];
  } catch {
    return [];
  }
}

export function toOnboardingState(org: OrganisationWithOnboarding): OnboardingState {
  const ob = org.onboarding;
  const crawl = org.crawlSessions[0];
  return {
    organisation: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      ownerName: org.ownerName,
      website: org.website ?? "",
      addToKnowledgeBase: org.addToKnowledgeBase,
      logoUrl: org.logoUrl,
    },
    currentStep: ob?.currentStep ?? 1,
    appDescription: ob?.appDescription ?? "",
    reachMode: (ob?.reachMode as ReachMode | null) ?? null,
    environmentUrl: ob?.environmentUrl ?? "",
    localPort: ob?.localPort ?? 3000,
    tunnelToken: ob?.tunnelToken ?? null,
    tunnelEnrolled: ob?.tunnelEnrolled ?? false,
    appLoginType: (ob?.appLoginType as AppLoginType | null) ?? null,
    appLoginUsername: ob?.appLoginUsername ?? "",
    hasAppLoginPassword: Boolean(ob?.appLoginPassword),
    painPoints: parseList<PainPoint>(ob?.painPoints ?? "[]"),
    userRole: (ob?.userRole as OnboardingRole | null) ?? null,
    testingMaturity: (ob?.testingMaturity as TestingMaturity | null) ?? null,
    focusPriority: (ob?.focusPriority as Focus | null) ?? null,
    invitedEmails: ob?.invitedEmails ? ob.invitedEmails.split("\n").filter(Boolean) : [],
    integrations: org.integrations.map((i) => ({
      provider: i.provider as Provider,
      status: i.status as IntegrationStatus,
      detail: i.detail,
    })),
    completed: Boolean(ob?.completedAt),
    crawl: crawl
      ? { id: crawl.id, targetUrl: crawl.targetUrl, status: crawl.status as CrawlStatus, startedAt: crawl.startedAt.toISOString() }
      : null,
    trialEndsAt: org.trialEndsAt.toISOString(),
  };
}

/** Loads the onboarding state of an organisation and settles finished indexing jobs. */
export async function loadOnboardingState(organisationId: string): Promise<OnboardingState | null> {
  await prisma.integration.updateMany({
    where: { organisationId, status: "INDEXING", updatedAt: { lte: new Date(Date.now() - 8000) } },
    data: { status: "CONNECTED" },
  });
  const org = await prisma.organisation.findUnique({ where: { id: organisationId }, include });
  return org ? toOnboardingState(org) : null;
}
