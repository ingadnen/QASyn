import { NextResponse } from "next/server";
import { prisma, ensureWal } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { mobileUploadSchema } from "@/lib/validation";

/** GET /api/dashboard/mobile/upload — mobile builds of the displayed organisation. */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  void ensureWal();
  const apps = await prisma.mobileApp.findMany({ where: { organisationId: guard.ctx.org.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ apps });
}

/** POST /api/dashboard/mobile/upload — simulated build upload (APK/IPA metadata). */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  void ensureWal();

  const parsed = mobileUploadSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, platform, version, fileName, sizeBytes } = parsed.data;
  const extension = platform === "iOS" ? ".ipa" : ".apk";
  if (!fileName.toLowerCase().endsWith(extension)) return jsonError(`A ${platform} build must end with ${extension}.`, 400);

  await delay(MOCK_LATENCY_MS);
  const [app] = await Promise.all([
    prisma.mobileApp.create({
      data: {
        organisationId: ctx.org.id,
        name,
        platform,
        version,
        fileUrl: `uploads/mobile/${fileName}`,
        sizeBytes,
      },
    }),
    prisma.upload.create({
      data: {
        organisationId: ctx.org.id,
        fileName,
        kind: platform === "iOS" ? "ipa" : "apk",
        sizeBytes,
        uploadedBy: ctx.user.email,
      },
    }),
  ]);
  await audit(prisma, ctx, "mobile.uploaded", `${platform} ${version} · ${fileName}`);
  return NextResponse.json({ app }, { status: 201 });
}
