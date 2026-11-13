import { prisma } from "./db";
import { sha256, verificationCode } from "./crypto";
import { getPlatformEmailRuntimeSecrets } from "./email-config";
import { forwardedForIsExternal } from "./rate-limit";

const CODE_TTL_MS = 15 * 60 * 1000;

/**
 * Issues a new e-mail verification code. When SMTP is not configured, the code can
 * also be surfaced through the sandbox inbox preview.
 */
export async function issueVerificationCode(userId: string): Promise<string> {
  const code = verificationCode();
  await prisma.user.update({
    where: { id: userId },
    data: { verifyCodeHash: sha256(code), verifyExpiresAt: new Date(Date.now() + CODE_TTL_MS), verifyAttempts: 0 },
  });
  return code;
}

/** The dev inbox can be disabled with QASYN_DISABLE_DEV_INBOX=1. */
export const devInbox = (code: string) => (process.env.QASYN_DISABLE_DEV_INBOX === "1" ? undefined : code);

/**
 * OTP preview is a local/sandbox convenience only. It is disabled when real
 * SMTP credentials are configured, unless the request is explicitly local and
 * does not arrive through a proxy, and can always be hard-disabled with
 * QASYN_OTP_PREVIEW=0.
 */
export async function otpPreviewAllowed(request: Request): Promise<boolean> {
  if (process.env.QASYN_OTP_PREVIEW === "0") return false;
  const forwardedHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).hostname)
    .split(":")[0]
    .trim()
    .toLowerCase();
  const hasForwardedFor = Boolean(request.headers.get("x-forwarded-for"));
  const local =
    (forwardedHost === "localhost" || forwardedHost === "127.0.0.1" || forwardedHost === "::1") &&
    (!hasForwardedFor || !forwardedForIsExternal(request));
  const runtime = await getPlatformEmailRuntimeSecrets();
  const smtpConfigured =
    runtime.enabled && Boolean((runtime.smtpHost && runtime.smtpPass) || runtime.resendApiKey);
  return local || !smtpConfigured;
}
