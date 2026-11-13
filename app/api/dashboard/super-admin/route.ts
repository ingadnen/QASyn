import { NextResponse } from "next/server";
import { z } from "zod";
import { PLAN_CREDITS } from "@/lib/constants";
import { hashPassword } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { isSuperAdmin } from "@/lib/rbac";
import { guardPermission } from "@/lib/rbac-server";
import { ETERNAL_TRIAL_CREDITS, SUPER_ADMIN_EMAIL } from "@/lib/super-admin";
import { PLANS, USER_ROLES } from "@/lib/types";
import { normalizeWebsite } from "@/lib/utils";

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
    website: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("user"),
    userId: z.string().min(1).max(60),
    role: z.enum(USER_ROLES).optional(),
    creditQuota: z.number().int().min(0).max(999_999_999).optional(),
    creditDelta: z.number().int().min(-999_999_999).max(999_999_999).optional(),
  }),
  z.object({
    action: z.literal("model"),
    organisationId: z.string().min(1).max(60),
    model: z.string().trim().min(1).max(160),
  }),
  z.object({
    action: z.literal("skill"),
    subAction: z.enum(["create", "update", "delete"]),
    id: z.string().max(80).optional(),
    name: z.string().trim().min(2).max(120).optional(),
    trigger: z.string().trim().max(240).optional(),
    systemPrompt: z.string().trim().min(10).max(12_000).optional(),
    model: z.string().trim().max(160).optional(),
    enabled: z.boolean().optional(),
  }),
]);

const enterpriseSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_enterprise_tenant"),
    organisationName: z.string().trim().min(2).max(120),
    slug: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
    website: z.string().trim().max(300).optional(),
    adminName: z.string().trim().min(2).max(120),
    adminEmail: z.string().trim().email().max(160),
    adminPassword: z.string().min(8).max(200),
    seats: z.number().int().min(1).max(10_000).default(25),
    environmentName: z.string().trim().max(80).optional(),
    environmentUrl: z.string().trim().max(300).optional(),
    trialCredits: z.number().int().min(0).max(999_999_999).optional(),
  }),
  z.object({
    action: z.literal("configure_enterprise_plan"),
    organisationId: z.string().min(1).max(60),
    plan: z.enum(PLANS).default("enterprise"),
    trialCredits: z.number().int().min(0).max(999_999_999).optional(),
    grantCredits: z.number().int().min(0).max(999_999_999).optional(),
    trialEndsAt: z.string().min(4).max(40).optional(),
    seats: z.number().int().min(1).max(10_000).optional(),
    website: z.string().trim().max(300).optional(),
    environmentName: z.string().trim().max(80).optional(),
    environmentUrl: z.string().trim().max(300).optional(),
    ssoEnabled: z.boolean().optional(),
    slaEnabled: z.boolean().optional(),
  }),
]);

/** URL-safe slug used for enterprise tenant provisioning. */
function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "enterprise"
  );
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value || "") as T;
  } catch {
    return fallback;
  }
}

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

  const [organisations, users, platformSkills] = await Promise.all([
    prisma.organisation.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        website: true,
        trialCredits: true,
        creditsUsed: true,
        trialEndsAt: true,
        settingsJson: true,
        integrations: { select: { provider: true, status: true, detail: true, connectedAt: true }, orderBy: { connectedAt: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true, organisationId: true, creditQuota: true, creditsConsumed: true, organisation: { select: { name: true } } },
      orderBy: [{ organisationId: "asc" }, { createdAt: "asc" }],
    }),
    prisma.platformSkill.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({
    organisations: organisations.map(({ settingsJson, integrations, ...org }) => {
      const settings = parseJson<{ customModels?: Array<{ name: string; provider: string }>; activeModel?: string }>(settingsJson, {});
      return {
        ...org,
        trialEndsAt: org.trialEndsAt.toISOString(),
        activeModel: settings.activeModel ?? "QASyn Vision AI",
        models: (settings.customModels ?? []).map((model) => `${model.name} (${model.provider})`),
        integrations: integrations.map((integration) => ({ ...integration, connectedAt: integration.connectedAt.toISOString() })),
      };
    }),
    users: users.map(({ organisation, ...user }) => ({ ...user, organisationName: organisation?.name ?? "—" })),
    platformSkills,
    roles: USER_ROLES,
    plans: PLANS,
    eternalCredits: ETERNAL_TRIAL_CREDITS,
  });
}

/** POST /api/dashboard/super-admin — enterprise tenant provisioning & plan configuration. */
export async function POST(request: Request) {
  const guard = await requireSuperAdmin();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = enterpriseSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  if (input.action === "create_enterprise_tenant") {
    const email = input.adminEmail.toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return jsonError("An account already exists for this admin e-mail.", 409);

    const baseSlug = input.slug ?? slugify(input.organisationName);
    let slug = baseSlug;
    for (let suffix = 2; suffix < 100; suffix++) {
      const collision = await prisma.organisation.findUnique({ where: { slug }, select: { id: true } });
      if (!collision) break;
      slug = `${baseSlug}-${suffix}`;
    }

    const trialEndsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const trialCredits = input.trialCredits ?? PLAN_CREDITS.enterprise;
    const website = input.website?.trim() || "https://www.cgi.com";
    const baseUrl = input.environmentUrl?.trim() || website;
    const passwordHash = await hashPassword(input.adminPassword);
    const initials =
      input.adminName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "EA";

    const provisioned = await prisma.$transaction(async (tx) => {
      const organisation = await tx.organisation.create({
        data: {
          name: input.organisationName,
          slug,
          ownerName: input.adminName,
          website,
          plan: "enterprise",
          trialCredits,
          trialEndsAt,
          paymentMethod: "Enterprise invoice",
          settingsJson: JSON.stringify({
            enterprise: {
              seats: input.seats,
              ssoEnabled: true,
              slaEnabled: true,
              provisionedAt: new Date().toISOString(),
              provisionedBy: ctx.user.email,
            },
          }),
        },
      });

      const environmentData = [
        {
          name: input.environmentName?.trim() || "Production",
          baseUrl,
          description: "Provisioned by Super Admin",
          isDefault: true,
        },
        {
          name: "Staging",
          baseUrl: input.environmentUrl?.trim() || website,
          description: "Enterprise staging environment",
          isDefault: false,
        },
      ];
      const environments = [];
      for (const environment of environmentData) {
        environments.push(
          await tx.environmentConfig.create({
            data: { organisationId: organisation.id, ...environment },
          }),
        );
      }

      const ledger = await tx.creditEntry.create({
        data: {
          organisationId: organisation.id,
          action: "Enterprise provisioning grant",
          credits: trialCredits,
          kind: "grant",
          note: `${input.seats} seat(s) · ${input.organisationName}`,
        },
      });

      const admin = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: input.adminName,
          role: "Admin",
          avatarInitials: initials,
          status: "active",
          emailVerifiedAt: new Date(),
          organisationId: organisation.id,
        },
      });

      await tx.systemAuditLog.create({
        data: {
          organisationId: organisation.id,
          actorEmail: ctx.user.email,
          action: "super_admin.enterprise_tenant_created",
          target: `${organisation.name} · ${trialCredits} credits · ${input.seats} seats · admin ${email}`,
        },
      });

      return { organisation, environments, ledger, admin };
    });

    return NextResponse.json(
      {
        organisation: {
          id: provisioned.organisation.id,
          name: provisioned.organisation.name,
          slug: provisioned.organisation.slug,
          plan: provisioned.organisation.plan,
          trialCredits: provisioned.organisation.trialCredits,
          creditsUsed: provisioned.organisation.creditsUsed,
          trialEndsAt: provisioned.organisation.trialEndsAt.toISOString(),
        },
        admin: {
          id: provisioned.admin.id,
          name: provisioned.admin.name,
          email: provisioned.admin.email,
          role: provisioned.admin.role,
          organisationId: provisioned.admin.organisationId,
          organisationName: provisioned.organisation.name,
          status: provisioned.admin.status,
        },
        environments: provisioned.environments.map((environment) => ({
          id: environment.id,
          name: environment.name,
          baseUrl: environment.baseUrl,
          isDefault: environment.isDefault,
        })),
        ledger: { id: provisioned.ledger.id, credits: provisioned.ledger.credits, kind: provisioned.ledger.kind },
      },
      { status: 201 },
    );
  }

  const org = await prisma.organisation.findUnique({ where: { id: input.organisationId } });
  if (!org) return jsonError("Organisation not found.", 404);
  const trialEndsAt = input.trialEndsAt ? new Date(input.trialEndsAt) : undefined;
  if (trialEndsAt && Number.isNaN(trialEndsAt.getTime())) return jsonError("Invalid trial end date.", 400);
  const nextWebsite = input.website !== undefined ? normalizeWebsite(input.website) : null;
  if (input.website !== undefined && !nextWebsite) return jsonError("Enter a valid website URL.", 400);

  const settings = parseJson<Record<string, unknown>>(org.settingsJson, {});
  const enterprise = {
    ...(typeof settings.enterprise === "object" && settings.enterprise ? (settings.enterprise as Record<string, unknown>) : {}),
    ...(input.seats !== undefined ? { seats: input.seats } : {}),
    ...(input.ssoEnabled !== undefined ? { ssoEnabled: input.ssoEnabled } : {}),
    ...(input.slaEnabled !== undefined ? { slaEnabled: input.slaEnabled } : {}),
    configuredAt: new Date().toISOString(),
    configuredBy: ctx.user.email,
  };
  const nextCredits =
    input.trialCredits !== undefined ? input.trialCredits : org.trialCredits + (input.grantCredits ?? 0);

  const configured = await prisma.$transaction(async (tx) => {
    const organisation = await tx.organisation.update({
      where: { id: org.id },
      data: {
        plan: input.plan,
        trialCredits: nextCredits,
        ...(trialEndsAt ? { trialEndsAt } : {}),
        ...(nextWebsite ? { website: nextWebsite } : {}),
        settingsJson: JSON.stringify({ ...settings, enterprise }),
      },
      select: { id: true, name: true, slug: true, plan: true, website: true, trialCredits: true, creditsUsed: true, trialEndsAt: true },
    });

    let environment = await tx.environmentConfig.findFirst({
      where: { organisationId: org.id, ...(input.environmentName ? { name: input.environmentName } : { isDefault: true }) },
    });
    if (input.environmentName || input.environmentUrl || nextWebsite) {
      if (environment) {
        environment = await tx.environmentConfig.update({
          where: { id: environment.id },
          data: {
            ...(input.environmentName ? { name: input.environmentName } : {}),
            ...(input.environmentUrl ? { baseUrl: input.environmentUrl } : nextWebsite ? { baseUrl: nextWebsite } : {}),
          },
        });
      } else {
        environment = await tx.environmentConfig.create({
          data: {
            organisationId: org.id,
            name: input.environmentName ?? "Production",
            baseUrl: input.environmentUrl ?? nextWebsite ?? org.website ?? "https://www.cgi.com",
            description: "Configured by Super Admin",
            isDefault: true,
          },
        });
      }
    }

    const ledger =
      input.grantCredits && input.grantCredits > 0
        ? await tx.creditEntry.create({
            data: {
              organisationId: org.id,
              action: "Enterprise credit grant",
              credits: input.grantCredits,
              kind: "grant",
              note: `${input.plan} plan · ${input.seats ?? enterprise.seats ?? "custom"} seat(s)`,
            },
          })
        : null;

    await tx.systemAuditLog.create({
      data: {
        organisationId: org.id,
        actorEmail: ctx.user.email,
        action: "super_admin.enterprise_plan_configured",
        target: `${org.name} → ${input.plan} · ${nextCredits} credits${input.grantCredits ? ` · +${input.grantCredits} grant` : ""}`,
      },
    });

    return { organisation, environment, ledger };
  });

  return NextResponse.json({
    organisation: { ...configured.organisation, trialEndsAt: configured.organisation.trialEndsAt.toISOString() },
    environment: configured.environment
      ? { id: configured.environment.id, name: configured.environment.name, baseUrl: configured.environment.baseUrl, isDefault: configured.environment.isDefault }
      : null,
    ledger: configured.ledger ? { id: configured.ledger.id, credits: configured.ledger.credits, kind: configured.ledger.kind } : null,
    enterprise,
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
    const nextWebsite = data.website !== undefined ? normalizeWebsite(data.website) : null;
    if (data.website !== undefined && !nextWebsite) return jsonError("Enter a valid website URL.", 400);
    const creditDelta = data.trialCredits !== undefined ? data.trialCredits - org.trialCredits : 0;
    const updated = await prisma.organisation.update({
      where: { id: org.id },
      data: {
        ...(data.plan ? { plan: data.plan } : {}),
        ...(data.trialCredits !== undefined ? { trialCredits: data.trialCredits } : {}),
        ...(data.creditsUsed !== undefined ? { creditsUsed: data.creditsUsed } : {}),
        ...(trialEndsAt ? { trialEndsAt } : {}),
        ...(nextWebsite ? { website: nextWebsite } : {}),
      },
      select: { id: true, name: true, plan: true, trialCredits: true, creditsUsed: true, trialEndsAt: true },
    });
    if (creditDelta !== 0) {
      await prisma.creditEntry.create({
        data: {
          organisationId: org.id,
          action: creditDelta > 0 ? "Super Admin credit grant" : "Super Admin credit deduction",
          credits: creditDelta,
          kind: creditDelta > 0 ? "grant" : "charge",
          note: `${org.name} · ${creditDelta > 0 ? "+" : ""}${creditDelta.toLocaleString("en-US")} credits · balance ${updated.trialCredits.toLocaleString("en-US")}`,
        },
      });
    }
    await prisma.systemAuditLog.create({
      data: { organisationId: org.id, actorEmail: ctx.user.email, action: "super_admin.organisation_updated", target: `${org.name} → ${updated.plan} · ${updated.trialCredits} credits${creditDelta !== 0 ? ` (${creditDelta > 0 ? "+" : ""}${creditDelta})` : ""}` },
    });
    return NextResponse.json({ organisation: { ...updated, trialEndsAt: updated.trialEndsAt.toISOString() } });
  }

  if (data.action === "model") {
    const org = await prisma.organisation.findUnique({ where: { id: data.organisationId }, select: { id: true, name: true, settingsJson: true } });
    if (!org) return jsonError("Organisation not found.", 404);
    const settings = parseJson<Record<string, unknown>>(org.settingsJson, {});
    const nextSettings = { ...settings, activeModel: data.model };
    await prisma.organisation.update({ where: { id: org.id }, data: { settingsJson: JSON.stringify(nextSettings) } });
    await prisma.systemAuditLog.create({
      data: { organisationId: org.id, actorEmail: ctx.user.email, action: "super_admin.tenant_model_updated", target: `${org.name} → ${data.model}`.slice(0, 200) },
    });
    return NextResponse.json({ organisationId: org.id, activeModel: data.model });
  }

  if (data.action === "skill") {
    if (data.subAction === "delete") {
      if (!data.id) return jsonError("Missing skill id.", 400);
      await prisma.platformSkill.deleteMany({ where: { id: data.id } });
      return NextResponse.json({ ok: true, skills: await prisma.platformSkill.findMany({ orderBy: { createdAt: "asc" } }) });
    }
    if (!data.name || !data.systemPrompt) return jsonError("Skill name and system prompt are required.", 400);
    const skill = data.subAction === "update" && data.id
      ? await prisma.platformSkill.update({
          where: { id: data.id },
          data: {
            name: data.name,
            trigger: data.trigger ?? "",
            systemPrompt: data.systemPrompt,
            model: data.model ?? "QASyn Vision AI",
            enabled: data.enabled ?? true,
          },
        })
      : await prisma.platformSkill.create({
          data: {
            name: data.name,
            trigger: data.trigger ?? "",
            systemPrompt: data.systemPrompt,
            model: data.model ?? "QASyn Vision AI",
            enabled: data.enabled ?? true,
          },
        });
    return NextResponse.json({ skill, skills: await prisma.platformSkill.findMany({ orderBy: { createdAt: "asc" } }) });
  }

  if (!data.role && data.creditQuota === undefined && data.creditDelta === undefined) {
    return jsonError("Provide a role, a token quota or a token delta.", 400);
  }
  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) return jsonError("User not found.", 404);
  if (user.email === SUPER_ADMIN_EMAIL && data.role && data.role !== "Super Admin") {
    return jsonError("The eternal Super Admin account must keep its role.", 400);
  }
  const tokenDelta =
    data.creditQuota !== undefined
      ? data.creditQuota - user.creditQuota
      : data.creditDelta ?? 0;
  const nextQuota =
    data.creditQuota !== undefined
      ? data.creditQuota
      : Math.max(0, user.creditQuota + (data.creditDelta ?? 0));
  if ((data.creditQuota !== undefined || data.creditDelta !== undefined) && !user.organisationId) {
    return jsonError("This user is not attached to a workspace.", 400);
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.role ? { role: data.role } : {}),
      ...(data.creditQuota !== undefined || data.creditDelta !== undefined ? { creditQuota: nextQuota } : {}),
    },
    select: { id: true, name: true, email: true, role: true, organisationId: true, creditQuota: true, creditsConsumed: true },
  });
  if (user.organisationId) {
    if (tokenDelta !== 0) {
      await prisma.creditEntry.create({
        data: {
          organisationId: user.organisationId,
          action: tokenDelta > 0 ? "Super Admin credit allocation" : "Super Admin credit deduction",
          credits: tokenDelta,
          kind: tokenDelta > 0 ? "grant" : "charge",
          note: `${user.email} · quota ${nextQuota.toLocaleString("en-US")}`,
        },
      });
    }
    await prisma.systemAuditLog.create({
      data: {
        organisationId: user.organisationId,
        actorEmail: ctx.user.email,
        action: "super_admin.user_updated",
        target: `${user.email} · ${data.role ?? user.role}${data.creditQuota !== undefined || data.creditDelta !== undefined ? ` · quota ${nextQuota.toLocaleString("en-US")}` : ""}`,
      },
    });
  }
  return NextResponse.json({ user: updated });
}
