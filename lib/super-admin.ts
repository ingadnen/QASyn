import { hashPassword } from "./crypto";
import { prisma } from "./db";

/**
 * Eternal platform owner.
 *
 * `admin@qasyn.com` sits above every workspace Admin: all permissions and
 * read/write access to every organisation. Its own "QASyn HQ" workspace keeps
 * enterprise plan, unlimited credits and an expiry in 2099. The function is
 * idempotent and never deletes workspace data.
 */

export const SUPER_ADMIN_EMAIL = "admin@qasyn.com";
export const SUPER_ADMIN_PASSWORD = "QASynMaster2026!";
export const SUPER_ADMIN_NAME = "QASyn Super Admin";
export const ETERNAL_TRIAL_ENDS_AT = new Date("2099-12-31T23:59:59Z");
export const ETERNAL_TRIAL_CREDITS = 9_999_999;

export async function ensureSuperAdmin() {
  const org = await prisma.organisation.upsert({
    where: { slug: "qasyn-hq" },
    update: {
      plan: "enterprise",
      trialCredits: ETERNAL_TRIAL_CREDITS,
      creditsUsed: 0,
      trialEndsAt: ETERNAL_TRIAL_ENDS_AT,
    },
    create: {
      name: "QASyn HQ",
      slug: "qasyn-hq",
      ownerName: SUPER_ADMIN_NAME,
      website: "https://www.qasyn.com",
      plan: "enterprise",
      trialStartsAt: new Date("2026-01-01T00:00:00Z"),
      trialEndsAt: ETERNAL_TRIAL_ENDS_AT,
      trialCredits: ETERNAL_TRIAL_CREDITS,
      creditsUsed: 0,
      settingsJson: JSON.stringify({ dismissed: [] }),
    },
  });

  const existing = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "Super Admin",
        name: existing.name || SUPER_ADMIN_NAME,
        status: "active",
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        organisationId: existing.organisationId ?? org.id,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        passwordHash: await hashPassword(SUPER_ADMIN_PASSWORD),
        name: SUPER_ADMIN_NAME,
        role: "Super Admin",
        avatarInitials: "SA",
        emailVerifiedAt: new Date(),
        status: "active",
        organisationId: org.id,
      },
    });
  }

  // CGI is the shared validation workspace: enterprise forever, full write.
  await prisma.organisation.updateMany({
    where: { slug: "cgi" },
    data: { plan: "enterprise", trialEndsAt: ETERNAL_TRIAL_ENDS_AT, trialCredits: ETERNAL_TRIAL_CREDITS },
  });
  await prisma.user.updateMany({
    where: { email: "cgi@cgi.com" },
    data: { role: "Admin", status: "active" },
  });

  return org;
}
