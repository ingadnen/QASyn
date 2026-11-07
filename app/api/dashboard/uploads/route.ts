import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import type { UPLOAD_KINDS } from "@/lib/types";
import { delay } from "@/lib/utils";
import { uploadSchema } from "@/lib/validation";

type UploadKind = (typeof UPLOAD_KINDS)[number];

function kindFromName(fileName: string): UploadKind {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "apk" || ext === "aab") return "apk";
  if (ext === "ipa") return "ipa";
  if (ext === "har") return "har";
  if (ext === "json" && /postman/i.test(fileName)) return "postman";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  return "other";
}

/**
 * POST /api/dashboard/uploads { fileName, sizeBytes, kind? }
 * Metadata only: file contents never leave the browser in this prototype.
 */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = uploadSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { fileName, sizeBytes, kind } = parsed.data;

  await delay(MOCK_LATENCY_MS);
  const upload = await prisma.upload.create({
    data: { organisationId: ctx.org.id, fileName, sizeBytes, kind: kind ?? kindFromName(fileName), uploadedBy: ctx.user.email },
  });
  await audit(prisma, ctx, "upload.created", fileName);
  return NextResponse.json({ upload }, { status: 201 });
}
