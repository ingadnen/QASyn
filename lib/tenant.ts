import type { Organisation, Prisma, PrismaClient, User } from "@prisma/client";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { getSession } from "./auth";
import { prisma } from "./db";
import { jsonError } from "./http";
import { isSuperAdmin } from "./rbac";

export interface OrgContext {
  sessionId: string;
  user: User;
  org: Organisation;
  /** The displayed organisation is not the user's own (demo workspace): read-only. */
  readOnly: boolean;
  /** The user's own organisation (null if not created yet) */
  ownOrg: Organisation | null;
}

/**
 * Resolves the organisation displayed for the current session.
 *
 * Normal users can reach their own organisation and the shared mock demo
 * (read-only). Super Admin can reach every organisation read/write.
 */
export async function resolveOrgContext(): Promise<OrgContext | null> {
  const session = await getSession();
  if (!session || !session.user.emailVerifiedAt) return null;
  const { user } = session;
  const superAdmin = isSuperAdmin(user.role);

  const ownOrg = user.organisationId ? await prisma.organisation.findUnique({ where: { id: user.organisationId } }) : null;

  let org: Organisation | null = ownOrg;
  if (superAdmin) {
    org = null;
    if (session.activeOrganisationId) {
      org = await prisma.organisation.findUnique({ where: { id: session.activeOrganisationId } });
    }
    if (!org) org = ownOrg;
    if (!org) org = await prisma.organisation.findFirst({ orderBy: { createdAt: "asc" } });
  } else if (session.activeOrganisationId && session.activeOrganisationId !== ownOrg?.id) {
    const candidate = await prisma.organisation.findUnique({ where: { id: session.activeOrganisationId } });
    if (candidate?.isMockDemo) org = candidate;
  }
  if (!org) return null;

  return { sessionId: session.sessionId, user, org, ownOrg, readOnly: superAdmin ? false : org.id !== ownOrg?.id };
}

/** Server Components (dashboard). */
export async function requireOrgContext(): Promise<OrgContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.emailVerifiedAt) redirect("/signup/verify");
  const ctx = await resolveOrgContext();
  if (!ctx) redirect("/onboard/organisation");
  return ctx;
}

type Guard = { ok: true; ctx: OrgContext } | { ok: false; response: NextResponse };

/** Route Handlers. `write: true` rejects the read-only demo workspace for non-members. */
export async function guardApi({ write = false }: { write?: boolean } = {}): Promise<Guard> {
  const session = await getSession();
  if (!session) return { ok: false, response: jsonError("Sign in to continue.", 401) };
  const ctx = await resolveOrgContext();
  if (!ctx) return { ok: false, response: jsonError("Create an organisation first.", 403) };
  if (write && ctx.readOnly) {
    return { ok: false, response: jsonError("The demo workspace is read-only. Switch back to your organisation.", 403) };
  }
  if (write && ctx.user.creditQuota > 0 && ctx.user.creditsConsumed >= ctx.user.creditQuota) {
    return {
      ok: false,
      response: jsonError(
        `User token quota exceeded (${ctx.user.creditsConsumed}/${ctx.user.creditQuota}). Ask your workspace admin to increase your allocation.`,
        402,
      ),
    };
  }
  return { ok: true, ctx };
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Route Handlers for onboarding: always the user's OWN organisation (never the demo). */
export async function guardOwnOrg(): Promise<Guard> {
  const session = await getSession();
  if (!session) return { ok: false, response: jsonError("Sign in to continue.", 401) };
  if (!session.user.emailVerifiedAt) return { ok: false, response: jsonError("Verify your e-mail first.", 403) };
  if (!session.user.organisationId) return { ok: false, response: jsonError("Create an organisation first.", 403) };
  const org = await prisma.organisation.findUnique({ where: { id: session.user.organisationId } });
  if (!org) return { ok: false, response: jsonError("Create an organisation first.", 403) };
  return { ok: true, ctx: { sessionId: session.sessionId, user: session.user, org, ownOrg: org, readOnly: false } };
}

export async function audit(db: Db, ctx: Pick<OrgContext, "org" | "user">, action: string, target: string) {
  // Audit must never fail the business operation: re-seeded users, deleted
  // users and partial sessions can leave the actor without an id/email.
  const actorEmail =
    String(ctx.user?.email ?? "").trim() ||
    String(ctx.user?.name ?? "").trim() ||
    "system@qasyn.local";
  try {
    await db.systemAuditLog.create({
      data: {
        organisationId: ctx.org.id,
        actorEmail,
        action,
        target: target.slice(0, 200),
      },
    });
  } catch (error) {
    console.warn("[audit] audit write skipped", { action, actorEmail, error: error instanceof Error ? error.message : String(error) });
  }
}

export class QuotaExceededError extends Error {
  readonly status = 402;
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

/** Maps a quota error to a 402 response; returns null for every other error. */
export function quotaErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof QuotaExceededError) return jsonError(error.message, 402);
  return null;
}

/**
 * Deducts credits from the organisation and, when a user is supplied, from the
 * user's assigned token quota. The user quota check and both increments run in
 * one interactive transaction so concurrent runs cannot overdraw a quota.
 */
export async function spendCredits(db: Db, organisationId: string, amount: number, userId?: string) {
  if (!Number.isFinite(amount) || amount <= 0) return;

  const apply = async (tx: Db) => {
    if (userId) {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { organisationId: true, creditQuota: true, creditsConsumed: true },
      });
      if (user && user.organisationId === organisationId && user.creditQuota > 0) {
        if (user.creditsConsumed + amount > user.creditQuota) {
          throw new QuotaExceededError(
            `User token quota exceeded (${user.creditsConsumed}/${user.creditQuota}). Ask your workspace admin to increase your allocation.`,
          );
        }
        await tx.user.update({ where: { id: userId }, data: { creditsConsumed: { increment: amount } } });
      }
    }

    const org = await tx.organisation.findUnique({
      where: { id: organisationId },
      select: { trialCredits: true, creditsUsed: true },
    });
    if (!org) return;
    const creditsUsed = Math.min(org.trialCredits, org.creditsUsed + amount);
    await tx.organisation.update({ where: { id: organisationId }, data: { creditsUsed } });
  };

  if (typeof (db as PrismaClient).$transaction === "function") {
    await (db as PrismaClient).$transaction(apply);
  } else {
    await apply(db);
  }
}

export interface OrganizationPreferences {
  defaultBrowser: "Chromium" | "Chrome" | "Firefox" | "Safari" | "Edge";
  testcaseTimeout: number;
  crawlTimeout: number;
  retryFailedSteps: number;
  waitTimeoutLocators: number;
  autoWaitDuration: number;
  captureStepScreenshots: boolean;
  videoRecording: boolean;
  autonomousCrawl: boolean;
  autoApproveAutoHeal: boolean;
  organizeByModule: boolean;
  showScrollbars: boolean;
  clickPressHold: boolean;
  viewport: "desktop" | "laptop" | "tablet" | "mobile";
  resolution: string;
  autoFix: boolean;
  autoFixRerunCount: number;
  timeZone: string;
  defaultAiAction: "Only action" | "Create step" | "Create dynamic step" | "Create Partial steps";
  aiSmartness: "Expert (Recommended)" | "Fast" | "Strict";
  knowledgeBaseId: string;
  useAiMetadata: boolean;
  mockApi: boolean;
  weeklyReportRecipients: string[];
}

export const DEFAULT_ORGANIZATION_PREFERENCES: OrganizationPreferences = {
  defaultBrowser: "Chrome",
  testcaseTimeout: 150,
  crawlTimeout: 30,
  retryFailedSteps: 1,
  waitTimeoutLocators: 15,
  autoWaitDuration: 200,
  captureStepScreenshots: false,
  videoRecording: false,
  autonomousCrawl: false,
  autoApproveAutoHeal: false,
  organizeByModule: true,
  showScrollbars: false,
  clickPressHold: false,
  viewport: "desktop",
  resolution: "",
  autoFix: true,
  autoFixRerunCount: 1,
  timeZone: "Central Time (US & Canada)",
  defaultAiAction: "Create step",
  aiSmartness: "Expert (Recommended)",
  knowledgeBaseId: "",
  useAiMetadata: true,
  mockApi: false,
  weeklyReportRecipients: [],
};

export interface AnalysisCodeSettings {
  baseBranches: string;
  maxFiles: number;
  pathScope: string;
  runMode: "never" | "after_merge" | "before_merge";
  environmentId: string;
  postPrComment: boolean;
  postStatusCheck: boolean;
  suppressPaths: string;
  /** Use the live Articul8 Bivia API; off keeps the calibrated local fallback. */
  biviaEnabled: boolean;
  /** AI Verification / AI Assertion steps. */
  biviaVerifyAi: boolean;
  /** Smart Locator / Magic UI calibration. */
  biviaMagicLocator: boolean;
  /** PR risk score and recommended regression subset. */
  biviaPrRisk: boolean;
  biviaMode: "fast" | "deep";
  /** 0–1 calibrated probability below which Bivia abstains. */
  biviaAbstentionThreshold: number;
}

export const DEFAULT_ANALYSIS_CODE_SETTINGS: AnalysisCodeSettings = {
  baseBranches: "main, release/*",
  maxFiles: 200,
  pathScope: "",
  runMode: "after_merge",
  environmentId: "",
  postPrComment: true,
  postStatusCheck: true,
  suppressPaths: "",
  biviaEnabled: true,
  biviaVerifyAi: true,
  biviaMagicLocator: true,
  biviaPrRisk: true,
  biviaMode: "fast",
  biviaAbstentionThreshold: 0.35,
};

export interface BugReproductionSettings {
  environmentId: string;
  dataProfileId: string;
  triggerMode: "label" | "every";
  triggerLabels: string[];
  triggerOnCreated: boolean;
  triggerOnLabeled: boolean;
  triggerOnEdited: boolean;
  triggerOnComment: boolean;
  maxPerTicket: number | null;
  maxPerDay: number | null;
  revalidate: boolean;
}

export const DEFAULT_BUG_REPRODUCTION_SETTINGS: BugReproductionSettings = {
  environmentId: "",
  dataProfileId: "",
  triggerMode: "label",
  triggerLabels: [],
  triggerOnCreated: true,
  triggerOnLabeled: true,
  triggerOnEdited: false,
  triggerOnComment: true,
  maxPerTicket: 3,
  maxPerDay: null,
  revalidate: true,
};

export interface OrgSettings {
  dismissed?: string[];
  analysis?: { severityThreshold: string; blockOnRegression: boolean; autoHealing: boolean; minCoverage: number; prComment: boolean };
  bugReproduction?: { autoReproduce: boolean; sources: string[]; captureVideo: boolean; captureNetwork: boolean; captureConsole: boolean; maxAttempts: number };
  organization?: OrganizationPreferences;
  analysisCode?: AnalysisCodeSettings;
  bugReproductionSettings?: BugReproductionSettings;
  codeAnalysisAt?: string;
  slackChannelCreated?: boolean;
  /** Learning progress: moduleId → { status, updatedAt } */
  learning?: Record<string, { status: string; updatedAt: string }>;
  /** RBAC permission matrix (permission → role → allowed) */
  permissions?: Record<string, Record<string, boolean>>;
  /** Tunnels alert delivery preferences. */
  tunnelAlerts?: { sendAlerts: boolean; delivery: "Immediate" | "Daily digest"; digestHour: string; channel: string; recipients?: string[] };
  /** Enabled Agent Skills Library ids. */
  agentSkills?: string[];
  /** Active model assigned by the Super Admin control plane. */
  activeModel?: string;
  /** Workspace-defined AI model providers (execution, grounding, PR review). */
  customModels?: Array<{ id: string; name: string; provider: string; modelId: string; apiKey: string; role: string; createdAt: string }>;
  /** Workspace-defined skills and autonomous agents. */
  customSkills?: Array<{ id: string; name: string; trigger: string; systemPrompt: string; model: string; enabled: boolean; createdAt: string }>;
  /** Encrypted default MCP token secret (AES-256-GCM), never rendered raw in settings UI. */
  mcpDefaultToken?: { tokenId: string; secret: string };
}

export function readSettings(org: Pick<Organisation, "settingsJson">): OrgSettings {
  try {
    const value = JSON.parse(org.settingsJson) as unknown;
    return value && typeof value === "object" ? (value as OrgSettings) : {};
  } catch {
    return {};
  }
}

export async function writeSettings(db: Db, org: Pick<Organisation, "id" | "settingsJson">, patch: Partial<OrgSettings>) {
  const next = { ...readSettings(org), ...patch };
  await db.organisation.update({ where: { id: org.id }, data: { settingsJson: JSON.stringify(next) } });
  return next;
}

export function trialDaysLeft(org: Pick<Organisation, "trialEndsAt">): number {
  return Math.max(0, Math.ceil((org.trialEndsAt.getTime() - Date.now()) / 86_400_000));
}
