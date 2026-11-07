import { NextResponse } from "next/server";
import { generateApiToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { apiTokenSchema } from "@/lib/validation";

const MAX_TOKENS = 10;

/** POST /api/dashboard/api-tokens { name } — the plain token is returned ONCE; only its SHA-256 is stored. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = apiTokenSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const count = await prisma.apiToken.count({ where: { organisationId: ctx.org.id } });
  if (count >= MAX_TOKENS) return jsonError(`You can have up to ${MAX_TOKENS} tokens. Revoke one first.`, 409);

  await delay(MOCK_LATENCY_MS / 2);
  const { token, prefix, hash } = generateApiToken();
  const record = await prisma.apiToken.create({
    data: { organisationId: ctx.org.id, name: parsed.data.name, tokenPrefix: prefix, tokenHash: hash },
    select: { id: true, name: true, tokenPrefix: true, createdAt: true },
  });
  await audit(prisma, ctx, "api_token.created", `${record.name} (${prefix}…)`);
  return NextResponse.json({ token, apiToken: record }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
