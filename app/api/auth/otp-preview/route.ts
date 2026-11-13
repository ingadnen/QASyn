import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlatformEmailRuntimeSecrets } from "@/lib/email-config";
import { jsonError } from "@/lib/http";
import { forwardedForIsExternal } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Sandbox/resend fallback: returns the latest verification code from the email
 * outbox only when the caller opts in with `x-qasyn-otp-preview: 1`.
 * Public deployments with real SMTP active always receive `{ code: null }`.
 */
export async function GET(request: Request) {
  if (process.env.QASYN_OTP_PREVIEW === "0") {
    return NextResponse.json({ code: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const forwardedHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).hostname)
    .split(":")[0]
    .trim()
    .toLowerCase();
  const hasForwardedFor = Boolean(request.headers.get("x-forwarded-for"));
  const localRequest =
    (forwardedHost === "localhost" || forwardedHost === "127.0.0.1" || forwardedHost === "::1") &&
    (!hasForwardedFor || !forwardedForIsExternal(request));
  const runtime = await getPlatformEmailRuntimeSecrets();
  const smtpConfigured =
    runtime.enabled && Boolean((runtime.smtpHost && runtime.smtpPass) || runtime.resendApiKey);
  const allowPreview = localRequest || !smtpConfigured;
  if (!allowPreview) return NextResponse.json({ code: null }, { headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("x-qasyn-otp-preview") !== "1") {
    return jsonError("Verification preview is not enabled.", 404);
  }
  const session = await getSession();
  if (!session) return jsonError("Sign in to continue.", 401);
  if (session.user.emailVerifiedAt) return jsonError("E-mail already verified.", 400);
  const row = await prisma.emailOutbox.findFirst({
    where: { to: session.user.email, subject: { contains: "verification" } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return jsonError("No verification email was sent yet. Resend the code first.", 404);
  const code = /\b(\d{6})\b/.exec(`${row.text ?? ""} ${row.html}`)?.[1];
  if (!code) return jsonError("The verification code is not available.", 404);
  return NextResponse.json({ code, email: session.user.email }, { headers: { "Cache-Control": "no-store" } });
}
