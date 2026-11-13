import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { dataUrlBase64, dataUrlMimeType, saveLeadAttachments, type LeadAttachmentFile } from "@/lib/lead-attachments";
import { sendLeadConfirmationEmailToSender, sendLeadNotificationEmail } from "@/lib/mailer";
import { clientKey, forwardedForIsExternal, rateLimit } from "@/lib/rate-limit";

const PUBLIC_CONTACT_EMAIL = "info@qasyn.io";
const attachmentDataUrl = z
  .string()
  .max(6_000_000)
  .refine((value) => /^data:[^;]+;base64,/.test(value), "Invalid attachment data URL.");

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
  cvFileName: z.string().trim().max(255).optional(),
  cvMimeType: z.string().trim().max(120).optional(),
  cvDataUrl: attachmentDataUrl.optional(),
  coverLetterFileName: z.string().trim().max(255).optional(),
  coverLetterMimeType: z.string().trim().max(120).optional(),
  coverLetterDataUrl: attachmentDataUrl.optional(),
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

  const uploadedAt = new Date().toISOString();
  const cv: LeadAttachmentFile | null = input.cvDataUrl
    ? {
        fileName: input.cvFileName?.trim() || "candidate-cv",
        mimeType: input.cvMimeType?.trim() || dataUrlMimeType(input.cvDataUrl, "application/octet-stream"),
        dataUrl: input.cvDataUrl,
        uploadedAt,
      }
    : null;
  const coverLetter: LeadAttachmentFile | null = input.coverLetterDataUrl
    ? {
        fileName: input.coverLetterFileName?.trim() || "cover-letter",
        mimeType: input.coverLetterMimeType?.trim() || dataUrlMimeType(input.coverLetterDataUrl, "application/octet-stream"),
        dataUrl: input.coverLetterDataUrl,
        uploadedAt,
      }
    : null;

  const metadata = {
    ...(input.metadata ?? {}),
    kind: input.kind,
    name,
    company: input.company,
    role: input.role,
    jobTitle: input.jobTitle,
    portfolioUrl: input.portfolioUrl,
    message: input.message,
    ...(cv ? { cvFileName: cv.fileName, cvMimeType: cv.mimeType } : {}),
    ...(coverLetter ? { coverLetterFileName: coverLetter.fileName, coverLetterMimeType: coverLetter.mimeType } : {}),
  };
  const source = input.source?.trim() || (input.kind ? `contact-us-${input.kind}` : "website");

  const lead = await prisma.leadCapture.create({
    data: {
      email: input.email,
      source,
      metadataJson: JSON.stringify(metadata),
    },
  });

  if (cv || coverLetter) {
    try {
      await saveLeadAttachments(lead.id, {
        ...(cv ? { cv } : {}),
        ...(coverLetter ? { coverLetter } : {}),
      });
    } catch (error) {
      console.warn("[marketing] lead attachment persistence failed", error instanceof Error ? error.message : String(error));
    }
  }

  const attachments = [
    ...(cv ? [{ filename: cv.fileName, contentType: cv.mimeType, base64Content: dataUrlBase64(cv.dataUrl) }] : []),
    ...(coverLetter
      ? [{ filename: coverLetter.fileName, contentType: coverLetter.mimeType, base64Content: dataUrlBase64(coverLetter.dataUrl) }]
      : []),
  ];

  await sendLeadNotificationEmail({
    kind,
    name,
    email: input.email,
    company: input.company,
    role: input.role,
    jobTitle: input.jobTitle,
    portfolioUrl: input.portfolioUrl,
    message: input.message,
    source,
    attachments,
  });

  await sendLeadConfirmationEmailToSender({
    kind,
    name,
    email: input.email,
    company: input.company,
    role: input.role,
    jobTitle: input.jobTitle,
    message: input.message,
    hasCv: Boolean(cv),
    hasCoverLetter: Boolean(coverLetter),
  });

  return NextResponse.json({ ok: true, recipient: PUBLIC_CONTACT_EMAIL });
}
