import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession, nextPathFor } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { verifySchema } from "@/lib/validation";

const MAX_ATTEMPTS = 5;

/** POST /api/auth/verify { code } — confirms the e-mail of the signed-in user. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to continue.", 401);
  const { user } = session;
  if (user.emailVerifiedAt) return NextResponse.json({ next: await nextPathFor(user) });

  const parsed = verifySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  if (!user.verifyCodeHash || !user.verifyExpiresAt || user.verifyExpiresAt.getTime() < Date.now()) {
    return jsonError("This code has expired. Send a new one.", 400);
  }
  if (user.verifyAttempts >= MAX_ATTEMPTS) return jsonError("Too many attempts. Send a new code.", 429);

  const expected = Buffer.from(user.verifyCodeHash, "hex");
  const actual = Buffer.from(sha256(parsed.data.code), "hex");
  if (!timingSafeEqual(expected, actual)) {
    await prisma.user.update({ where: { id: user.id }, data: { verifyAttempts: { increment: 1 } } });
    return jsonError("That code isn't right. Check the e-mail and try again.", 400);
  }

  const verified = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), verifyCodeHash: null, verifyExpiresAt: null, verifyAttempts: 0 },
  });
  return NextResponse.json({ next: await nextPathFor(verified) });
}
