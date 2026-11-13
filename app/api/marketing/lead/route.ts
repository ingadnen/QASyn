import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { CONTACT_RECIPIENT_EMAIL, sendLeadNotificationEmail } from "@/lib/mailer";
import { clientKey, forwardedForIsExternal, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  kind: z.enum(["demo", "contact", "career"]).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  email: z.string().email(),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  jobTitle: z.string().trim().max(200).optional(),
  portfolioUrl: z.string().trim().max(500).optional(),
  message: z.string().trim().max(5_000).optional(),
  source: z.string().trim().min(2).max(60).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** POST /api/marketing/lead — demo, contact, career and legacy lead capture. */
export async function POST(request: Request) {
  void ensureWal();
  const forwardedHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).hostname)
    .split(":")[0]
    .trim()
    .toLowerCase();
  const hasForwardedFor = Boolean(request.headers.get("x-forwarded-for"));
  const localVerification =
    (forwardedHost === "localhost" || forwardedHost === "127.0.0.1" || forwardedHost === "::1") &&
    (!hasForwardedFor || !forwardedForIsExternal(request));
  if (!localVerification && !rateLimit(`lead:${clientKey(request)}`, 15, 10 * 60_000)) {
    return jsonError("Too many requests. Please try again in a few minutes.", 429);
  }
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const kind = input.kind ?? "contact";
  const name = input.name?.trim() || input.email.split("@")[0];

  if (input.kind && !input.name?.trim()) {
    return jsonError("Full name is required.", 400);
  }
  if (input.kind === "career" && !input.jobTitle?.trim()) {
    return jsonError("The role applied for is required.", 400);
  }

  const metadata = {
    ...(input.metadata ?? {}),
    kind: input.kind,
    name,
    company: input.company,
    role: input.role,
    jobTitle: input.jobTitle,
    portfolioUrl: input.portfolioUrl,
    message: input.message,
  };
  const source = input.source?.trim() || (input.kind ? `contact-us-${input.kind}` : "website");

  await prisma.leadCapture.create({
    data: {
      email: input.email,
      source,
      metadataJson: JSON.stringify(metadata),
    },
  });

  await sendLeadNotificationEmail({
    kind: input.kind ?? "contact",
    name,
    email: input.email,
    company: input.company,
    role: input.role,
    jobTitle: input.jobTitle,
    portfolioUrl: input.portfolioUrl,
    message: input.message,
    source,
  });

  return NextResponse.json({ ok: true, recipient: CONTACT_RECIPIENT_EMAIL });
}
