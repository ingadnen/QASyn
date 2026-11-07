import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { devInbox, issueVerificationCode } from "@/lib/verification";

/** POST /api/auth/resend — new verification code for the signed-in, unverified user. */
export async function POST() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to continue.", 401);
  if (session.user.emailVerifiedAt) return jsonError("E-mail already verified.", 400);
  if (!rateLimit(`resend:${session.user.id}`, 5, 15 * 60_000)) return jsonError("Too many codes requested. Wait a few minutes.", 429);
  const code = await issueVerificationCode(session.user.id);
  return NextResponse.json({ ok: true, devCode: devInbox(code) });
}
