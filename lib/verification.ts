import { prisma } from "./db";
import { sha256, verificationCode } from "./crypto";

const CODE_TTL_MS = 15 * 60 * 1000;

/**
 * Issues a new e-mail verification code. There is no outbound e-mail in this local
 * prototype: the code is returned so the UI can show it in a "local inbox" preview.
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
