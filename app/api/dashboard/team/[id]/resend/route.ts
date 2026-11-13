import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { sendInvitationEmail } from "@/lib/mailer";
import { guardPermission } from "@/lib/rbac-server";
import { audit } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

/** POST /api/dashboard/team/[id]/resend — refreshes and re-sends a pending invitation. */
export async function POST(request: Request, { params }: Params) {
  const guard = await guardPermission("teamManage", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const member = await prisma.user.findFirst({
    where: { id, organisationId: ctx.org.id },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!member) return jsonError("Member not found.", 404);
  if (member.status !== "invited") return jsonError("This member has already accepted their invitation.", 400);

  const expiresAt = new Date(Date.now() + 7 * 86_400_000);
  const existing = await prisma.teamInvite.findFirst({
    where: { organisationId: ctx.org.id, email: member.email, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  const invite = existing
    ? await prisma.teamInvite.update({ where: { id: existing.id }, data: { expiresAt, role: member.role } })
    : await prisma.teamInvite.create({
        data: {
          token: randomBytes(24).toString("base64url"),
          organisationId: ctx.org.id,
          email: member.email,
          role: member.role,
          invitedByEmail: ctx.user.email,
          expiresAt,
        },
      });

  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const inviteUrl = `${origin}/invite/${invite.token}`;
  await sendInvitationEmail(member.email, inviteUrl, ctx.org.name, member.role);
  await audit(prisma, ctx, "member.invite_resent", member.email);
  return NextResponse.json({ inviteUrl, token: invite.token, expiresAt: invite.expiresAt.toISOString() });
}
