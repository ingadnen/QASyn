import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, initialsOf } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";

type Params = { params: Promise<{ token: string }> };

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  password: z.string().min(10).max(200),
});

/** POST /api/invites/[token] - accept a signed team invitation. */
export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { organisation: { select: { id: true, name: true } } },
  });
  if (!invite) return jsonError("This invitation link is invalid.", 404);
  if (invite.status !== "pending") return jsonError("This invitation has already been used.", 409);
  if (invite.expiresAt.getTime() < Date.now()) return jsonError("This invitation has expired. Ask your admin to resend it.", 410);

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing?.passwordHash && existing.organisationId && existing.organisationId !== invite.organisationId) {
    return jsonError("This e-mail already belongs to another workspace.", 409);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          passwordHash,
          status: "active",
          emailVerifiedAt: new Date(),
          organisationId: invite.organisationId,
          role: invite.role,
          avatarInitials: initialsOf(parsed.data.name, invite.email),
          verifyCodeHash: null,
          verifyExpiresAt: null,
          verifyAttempts: 0,
        },
      })
    : await prisma.user.create({
        data: {
          email: invite.email,
          name: parsed.data.name,
          passwordHash,
          status: "active",
          emailVerifiedAt: new Date(),
          organisationId: invite.organisationId,
          role: invite.role,
          avatarInitials: initialsOf(parsed.data.name, invite.email),
        },
      });

  await prisma.$transaction([
    prisma.teamInvite.update({ where: { id: invite.id }, data: { status: "accepted", acceptedAt: new Date() } }),
    prisma.systemAuditLog.create({
      data: {
        organisationId: invite.organisationId,
        actorEmail: invite.email,
        action: "member.invite_accepted",
        target: `${invite.organisation.name} · ${invite.role}`.slice(0, 200),
      },
    }),
  ]);
  await createSession(user.id, invite.organisationId);
  return NextResponse.json({ next: "/dashboard/overview", organisation: invite.organisation.name, role: invite.role });
}
