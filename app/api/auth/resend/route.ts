import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { sendVerificationEmail } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import { issueVerificationCode, otpPreviewAllowed } from "@/lib/verification";

/** POST /api/auth/resend — new verification code for the signed-in, unverified user. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to continue.", 401);
  if (session.user.emailVerifiedAt) return jsonError("E-mail already verified.", 400);
  if (!rateLimit(`resend:${session.user.id}`, 5, 15 * 60_000)) return jsonError("Too many codes requested. Wait a few minutes.", 429);
  const code = await issueVerificationCode(session.user.id);
  await sendVerificationEmail(session.user.email, code);
  const headers: Record<string, string> = {};
  if (otpPreviewAllowed(request)) headers["x-qasyn-otp-preview"] = code;
  return NextResponse.json({ ok: true, emailSent: true }, { headers });
}
