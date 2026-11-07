import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, ensureWal } from "@/lib/db";
import { readJson, validationError } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  source: z.string().trim().min(2).max(60),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** POST /api/marketing/lead — lead capture (ROI, ebook, webinar, newsletter, pilot). */
export async function POST(request: Request) {
  void ensureWal();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  await prisma.leadCapture.create({
    data: { email: parsed.data.email, source: parsed.data.source, metadataJson: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
