import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Sandbox/resend fallback: returns the latest verification code from the email
 * outbox only when the caller opts in with `x-qasyn-otp-preview: 1`.
 * The public signup page never renders the raw code by default.
 */
export async function GET(request: Request) {
  if (request.headers.get("x-qasyn-otp-preview") !== "1") return jsonError("Verification preview is not enabled.", 404);
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
