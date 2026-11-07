import type { Organisation, User } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomToken, sha256 } from "./crypto";
import { prisma } from "./db";

/** httpOnly cookie that holds the random session token (only its SHA-256 is stored). */
export const SESSION_COOKIE = "qasyn_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthSession {
  sessionId: string;
  user: User;
  activeOrganisationId: string | null;
}

/** Route Handlers / Server Actions only (sets a cookie). */
export async function createSession(userId: string, activeOrganisationId: string | null = null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { tokenHash: sha256(token), userId, activeOrganisationId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  store.delete(SESSION_COOKIE);
}

/** Current session (memoised per request). */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return { sessionId: session.id, user: session.user, activeOrganisationId: session.activeOrganisationId };
});

export async function setActiveOrganisation(sessionId: string, organisationId: string | null) {
  await prisma.session.update({ where: { id: sessionId }, data: { activeOrganisationId: organisationId } });
}

/** Where a signed-in user should land next. */
export async function nextPathFor(user: User): Promise<string> {
  if (!user.emailVerifiedAt) return "/signup/verify";
  if (!user.organisationId) return "/onboard/organisation";
  const onboarding = await prisma.onboarding.findUnique({ where: { organisationId: user.organisationId } });
  if (onboarding && !onboarding.completedAt) return `/onboarding/${onboarding.currentStep}`;
  return "/dashboard/overview";
}

/** Server Components: require a verified user. */
export async function requireUser(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.emailVerifiedAt) redirect("/signup/verify");
  return session;
}

/** Server Components: require a verified user that owns an organisation. */
export async function requireOwnOrganisation(): Promise<AuthSession & { org: Organisation }> {
  const session = await requireUser();
  if (!session.user.organisationId) redirect("/onboard/organisation");
  const org = await prisma.organisation.findUnique({ where: { id: session.user.organisationId } });
  if (!org) redirect("/onboard/organisation");
  return { ...session, org };
}

export function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? email).slice(0, 2);
  return letters.toUpperCase();
}
