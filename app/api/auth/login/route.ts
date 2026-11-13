import { NextResponse } from "next/server";
import { createSession, nextPathFor } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import { devInbox, issueVerificationCode } from "@/lib/verification";

/** POST /api/auth/login { email, password } */
export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { email, password } = parsed.data;

  const forwardedHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).hostname)
    .split(":")[0]
    .trim()
    .toLowerCase();
  const hasForwardedFor = Boolean(request.headers.get("x-forwarded-for"));
  const localVerification =
    (forwardedHost === "localhost" || forwardedHost === "127.0.0.1" || forwardedHost === "::1") && !hasForwardedFor;
  if (!localVerification && (!rateLimit(`login:${email}`, 8, 15 * 60_000) || !rateLimit(`login-ip:${clientKey(request)}`, 30, 15 * 60_000))) {
    return jsonError("Too many attempts. Try again in a few minutes.", 429);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Same message whether the account exists or not (no user enumeration).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return jsonError("Incorrect e-mail or password.", 401);
  }

  await createSession(user.id, user.organisationId);
  const next = await nextPathFor(user);
  const devCode = !user.emailVerifiedAt ? devInbox(await issueVerificationCode(user.id)) : undefined;
  return NextResponse.json({ next, devCode });
}
