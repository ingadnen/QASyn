import type { Organisation, Prisma, PrismaClient, User } from "@prisma/client";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { getSession } from "./auth";
import { prisma } from "./db";
import { jsonError } from "./http";

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
 * Only two organisations are ever reachable: the user's own organisation and
 * the shared mock demo ("Acme", isMockDemo = true). Any other id is ignored.
 */
export async function resolveOrgContext(): Promise<OrgContext | null> {
  const session = await getSession();
  if (!session || !session.user.emailVerifiedAt) return null;
  const { user } = session;

  const ownOrg = user.organisationId ? await prisma.organisation.findUnique({ where: { id: user.organisationId } }) : null;

  let org: Organisation | null = ownOrg;
  if (session.activeOrganisationId && session.activeOrganisationId !== ownOrg?.id) {
    const candidate = await prisma.organisation.findUnique({ where: { id: session.activeOrganisationId } });
    if (candidate?.isMockDemo) org = candidate;
  }
  if (!org) return null;

  return { sessionId: session.sessionId, user, org, ownOrg, readOnly: org.id !== ownOrg?.id };
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
  await db.systemAuditLog.create({
    data: { organisationId: ctx.org.id, actorEmail: ctx.user.email, action, target: target.slice(0, 200) },
  });
}

/** Deducts simulated credits (never below zero). */
export async function spendCredits(db: Db, organisationId: string, amount: number) {
  const org = await db.organisation.findUnique({ where: { id: organisationId }, select: { trialCredits: true, creditsUsed: true } });
  if (!org) return;
  const creditsUsed = Math.min(org.trialCredits, org.creditsUsed + amount);
  await db.organisation.update({ where: { id: organisationId }, data: { creditsUsed } });
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
