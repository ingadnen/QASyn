import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";
import { randomBytes } from "node:crypto";

const schema = z.object({
  badgeName: z.string().trim().min(2).max(80),
  candidateName: z.string().trim().min(2).max(80),
  candidateEmail: z.string().email(),
  score: z.number().int().min(0).max(100),
});

/** POST /api/marketing/certification — issue a certificate code. */
export async function POST(request: Request) {
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { badgeName, candidateName, candidateEmail, score } = parsed.data;
  const courseSlug = badgeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const course = await prisma.course.findFirst({ where: { badgeName } });
  const certification = await prisma.certification.create({
    data: {
      courseId: course?.id ?? courseSlug,
      candidateName,
      candidateEmail,
      certCode: `QA-${randomBytes(4).toString("hex").toUpperCase()}`,
      score,
    },
  });
  return NextResponse.json({ certification }, { status: 201 });
}

/** GET /api/marketing/certification?code=… — verify a certificate. */
export async function GET(request: Request) {
  void ensureWal();
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!code) return NextResponse.json({ valid: false });
  const cert = await prisma.certification.findUnique({ where: { certCode: code.toUpperCase() } });
  return NextResponse.json({ valid: !!cert, candidateName: cert?.candidateName ?? null, score: cert?.score ?? null, issuedAt: cert?.issuedAt ?? null });
}
