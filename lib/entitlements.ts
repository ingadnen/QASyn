/**
 * Plan entitlement matrix (Phase 32). One source of truth for what each plan
 * allows: seats, projects, credits, allowed integrations, sync cadence,
 * extension/desktop access and gated capabilities. Trial plans get PRO-grade
 * entitlements. Roles are enforced separately by lib/rbac.ts.
 */
export type PlanTier = "trial" | "free" | "starter" | "pro" | "enterprise";

export interface PlanEntitlements {
  /** Seconds between real-time sync passes for connected integrations. */
  syncIntervalSeconds: number;
  /** True when the plan may use the real-time sync engine at all. */
  realtimeSync: boolean;
  /** Included seats (Infinity for enterprise). */
  seats: number;
  /** Connected repositories/projects across all providers. */
  projects: number;
  /** Monthly AI credit allowance (Infinity = unlimited, -1 = pay as you go). */
  creditsPerMonth: number;
  /** Source-control and tracker providers the plan may connect. */
  integrations: string[];
  /** Chrome MV3 extension access. */
  extensionAccess: boolean;
  /** Windows agent / desktop runner access. */
  desktopAccess: boolean;
  /** AI PR impact analysis + drafted regression tests. */
  aiPrAnalysis: boolean;
  /** Autonomous Ship workflows (crawl → generate → execute → report). */
  autopilot: boolean;
  /** Gate label shown on upgrade CTAs. */
  upgradeLabel: string;
}

const ALL_INTEGRATIONS = [
  "GITHUB",
  "GITLAB",
  "AZURE_DEVOPS",
  "JIRA",
  "LINEAR",
  "SLACK",
  "CONFLUENCE",
  "NOTION",
  "FIGMA",
] as const;

const PLAN_ENTITLEMENTS: Record<PlanTier, PlanEntitlements> = {
  trial: {
    syncIntervalSeconds: 1,
    realtimeSync: true,
    seats: 10,
    projects: 10,
    creditsPerMonth: 3000,
    integrations: [...ALL_INTEGRATIONS],
    extensionAccess: true,
    desktopAccess: true,
    aiPrAnalysis: true,
    autopilot: true,
    upgradeLabel: "Trial",
  },
  free: {
    syncIntervalSeconds: 30,
    realtimeSync: true,
    seats: 3,
    projects: 1,
    creditsPerMonth: 200,
    integrations: ["GITHUB", "JIRA", "SLACK"],
    extensionAccess: false,
    desktopAccess: false,
    aiPrAnalysis: true,
    autopilot: false,
    upgradeLabel: "Starter",
  },
  starter: {
    syncIntervalSeconds: 10,
    realtimeSync: true,
    seats: 5,
    projects: 3,
    creditsPerMonth: 1200,
    integrations: ["GITHUB", "GITLAB", "AZURE_DEVOPS", "JIRA", "SLACK"],
    extensionAccess: true,
    desktopAccess: false,
    aiPrAnalysis: true,
    autopilot: false,
    upgradeLabel: "Pro",
  },
  pro: {
    syncIntervalSeconds: 1,
    realtimeSync: true,
    seats: 15,
    projects: 15,
    creditsPerMonth: 6000,
    integrations: [...ALL_INTEGRATIONS],
    extensionAccess: true,
    desktopAccess: true,
    aiPrAnalysis: true,
    autopilot: true,
    upgradeLabel: "Enterprise",
  },
  enterprise: {
    syncIntervalSeconds: 1,
    realtimeSync: true,
    seats: Number.POSITIVE_INFINITY,
    projects: Number.POSITIVE_INFINITY,
    creditsPerMonth: Number.POSITIVE_INFINITY,
    integrations: [...ALL_INTEGRATIONS],
    extensionAccess: true,
    desktopAccess: true,
    aiPrAnalysis: true,
    autopilot: true,
    upgradeLabel: "Enterprise",
  },
};

export function planEntitlements(plan: string | null | undefined): PlanEntitlements {
  const tier = (plan ?? "free").toLowerCase() as PlanTier;
  return PLAN_ENTITLEMENTS[tier] ?? PLAN_ENTITLEMENTS.free;
}

/** True when the plan may connect the given provider. */
export function planAllowsIntegration(plan: string | null | undefined, provider: string): boolean {
  return planEntitlements(plan).integrations.includes(provider.toUpperCase());
}

/** True when the org is within its seat/project allowances. */
export function planWithinLimits(
  plan: string | null | undefined,
  usage: { seats?: number; projects?: number },
): { ok: boolean; limit: number; used: number } {
  const entitlements = planEntitlements(plan);
  if (usage.projects != null) {
    return { ok: usage.projects <= entitlements.projects, limit: entitlements.projects, used: usage.projects };
  }
  const seats = usage.seats ?? 0;
  return { ok: seats <= entitlements.seats, limit: entitlements.seats, used: seats };
}
