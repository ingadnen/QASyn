import { NextResponse } from "next/server";
import { createSession, initialsOf } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { sendVerificationEmail } from "@/lib/mailer";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { capitalize } from "@/lib/utils";
import { signupSchema } from "@/lib/validation";
import { issueVerificationCode, otpPreviewAllowed } from "@/lib/verification";

/** POST /api/auth/signup { email, password } → unverified user + session + verification code. */
export async function POST(request: Request) {
  if (!rateLimit(`signup:${clientKey(request)}`, 10, 15 * 60_000)) return jsonError("Too many attempts. Try again later.", 429);

  const parsed = signupSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.passwordHash) return jsonError("An account already exists for this e-mail. Log in instead.", 409);

  const passwordHash = await hashPassword(password);
  const name = capitalize(email.split("@")[0].replace(/[._-]+/g, " ").trim()) || "New user";

  // An invited teammate (no password yet) claims the invitation by signing up.
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, status: "active" } })
    : await prisma.user.create({ data: { email, passwordHash, name, avatarInitials: initialsOf(name, email), role: "Admin" } });

  await createSession(user.id, user.organisationId);
  const code = await issueVerificationCode(user.id);
  await sendVerificationEmail(email, code);
  const headers: Record<string, string> = {};
  if (otpPreviewAllowed(request)) headers["x-qasyn-otp-preview"] = code;
  return NextResponse.json({ next: "/signup/verify", emailSent: true }, { headers });
}
