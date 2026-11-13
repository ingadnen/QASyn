import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { initialsOf } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { sendInvitationEmail } from "@/lib/mailer";
import { audit } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { inviteSchema } from "@/lib/validation";

export async function GET() {
  const guard = await guardPermission("team");
  if (!guard.ok) return guard.response;
  const [members, invites] = await Promise.all([
    prisma.user.findMany({
      where: { organisationId: guard.ctx.org.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, status: true, avatarInitials: true, creditQuota: true, creditsConsumed: true, createdAt: true },
    }),
    prisma.teamInvite.findMany({
      where: { organisationId: guard.ctx.org.id, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true },
    }),
  ]);
  return NextResponse.json({ members, invites });
}

/** POST /api/dashboard/team { email, role } — invites a teammate (simulated e-mail). */
export async function POST(request: Request) {
  const guard = await guardPermission("teamManage", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = inviteSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { email, role } = parsed.data;
  const roles = parsed.data.roles && parsed.data.roles.length > 0 ? parsed.data.roles : [role];
  const displayName = parsed.data.name?.trim() || email.split("@")[0];
  const primaryRole = roles[0];

  const existing = await prisma.user.findUnique({ where: { email }, select: { organisationId: true } });
  if (existing) {
    return jsonError(
      existing.organisationId === ctx.org.id ? "This person is already a member." : "This e-mail already belongs to another workspace.",
      409,
    );
  }

  await delay(MOCK_LATENCY_MS);
  const member = await prisma.user.create({
    data: { email, name: displayName, avatarInitials: initialsOf(displayName, email), role: primaryRole, status: "invited", organisationId: ctx.org.id },
    select: { id: true, email: true, role: true, status: true },
  });
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 86_400_000);
  await prisma.teamInvite.deleteMany({ where: { organisationId: ctx.org.id, email, status: "pending" } });
  const invite = await prisma.teamInvite.create({
    data: {
      token,
      organisationId: ctx.org.id,
      email,
      role: primaryRole,
      invitedByEmail: ctx.user.email,
      expiresAt,
    },
  });
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const inviteUrl = `${origin}/invite/${invite.token}`;
  await sendInvitationEmail(email, inviteUrl, ctx.org.name, primaryRole);
  await audit(prisma, ctx, "member.invited", `${email} → ${role}`);
  return NextResponse.json({ member, inviteUrl, invite: { id: invite.id, email, role: primaryRole, token: invite.token, expiresAt: invite.expiresAt.toISOString() } }, { status: 201 });
}
