import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { isSuperAdmin } from "@/lib/rbac";
import { guardPermission } from "@/lib/rbac-server";
import { ETERNAL_TRIAL_CREDITS, SUPER_ADMIN_EMAIL } from "@/lib/super-admin";
import { PLANS, USER_ROLES } from "@/lib/types";

/**
 * Super-Admin Console API.
 * GET  → every organisation and every user.
 * PATCH→ change an organisation's plan/credits or any user's role.
 */

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("organisation"),
    organisationId: z.string().min(1).max(60),
    plan: z.enum(PLANS).optional(),
    trialCredits: z.number().int().min(0).max(999_999_999).optional(),
    creditsUsed: z.number().int().min(0).max(999_999_999).optional(),
    trialEndsAt: z.string().min(4).max(40).optional(),
  }),
  z.object({
    action: z.literal("user"),
    userId: z.string().min(1).max(60),
    role: z.enum(USER_ROLES),
  }),
]);

async function requireSuperAdmin() {
  const guard = await guardPermission("settingsManage", { write: true });
  if (!guard.ok) return guard;
  if (!isSuperAdmin(guard.ctx.user.role)) {
    return { ok: false as const, response: jsonError("Super Admin access required.", 403) };
  }
  return guard;
}

export async function GET() {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;

  const [organisations, users] = await Promise.all([
    prisma.organisation.findMany({
      select: { id: true, name: true, slug: true, plan: true, trialCredits: true, creditsUsed: true, trialEndsAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true, organisationId: true, organisation: { select: { name: true } } },
      orderBy: [{ organisationId: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return NextResponse.json({
    organisations: organisations.map((org) => ({ ...org, trialEndsAt: org.trialEndsAt.toISOString() })),
    users: users.map(({ organisation, ...user }) => ({ ...user, organisationName: organisation?.name ?? "—" })),
    roles: USER_ROLES,
    plans: PLANS,
    eternalCredits: ETERNAL_TRIAL_CREDITS,
  });
}

export async function PATCH(request: Request) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;

  if (data.action === "organisation") {
    const org = await prisma.organisation.findUnique({ where: { id: data.organisationId } });
    if (!org) return jsonError("Organisation not found.", 404);
    const trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : undefined;
    if (trialEndsAt && Number.isNaN(trialEndsAt.getTime())) return jsonError("Invalid trial end date.", 400);
    const updated = await prisma.organisation.update({
      where: { id: org.id },
      data: {
        ...(data.plan ? { plan: data.plan } : {}),
        ...(data.trialCredits !== undefined ? { trialCredits: data.trialCredits } : {}),
        ...(data.creditsUsed !== undefined ? { creditsUsed: data.creditsUsed } : {}),
        ...(trialEndsAt ? { trialEndsAt } : {}),
      },
      select: { id: true, name: true, plan: true, trialCredits: true, creditsUsed: true, trialEndsAt: true },
    });
    await prisma.systemAuditLog.create({
      data: { organisationId: org.id, actorEmail: ctx.user.email, action: "super_admin.organisation_updated", target: `${org.name} → ${updated.plan} · ${updated.trialCredits} credits` },
    });
    return NextResponse.json({ organisation: { ...updated, trialEndsAt: updated.trialEndsAt.toISOString() } });
  }

  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) return jsonError("User not found.", 404);
  if (user.email === SUPER_ADMIN_EMAIL && data.role !== "Super Admin") {
    return jsonError("The eternal Super Admin account must keep its role.", 400);
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: data.role },
    select: { id: true, name: true, email: true, role: true, organisationId: true },
  });
  if (user.organisationId) {
    await prisma.systemAuditLog.create({
      data: { organisationId: user.organisationId, actorEmail: ctx.user.email, action: "super_admin.user_role_updated", target: `${user.email} → ${data.role}` },
    });
  }
  return NextResponse.json({ user: updated });
}
