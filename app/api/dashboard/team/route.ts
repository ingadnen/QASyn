import { NextResponse } from "next/server";
import { initialsOf } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { inviteSchema } from "@/lib/validation";

export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const members = await prisma.user.findMany({
    where: { organisationId: guard.ctx.org.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, status: true, avatarInitials: true, createdAt: true },
  });
  return NextResponse.json({ members });
}

/** POST /api/dashboard/team { email, role } — invites a teammate (simulated e-mail). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
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
  await audit(prisma, ctx, "member.invited", `${email} · ${role}`);
  return NextResponse.json({ member }, { status: 201 });
}
