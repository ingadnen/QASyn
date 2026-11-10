import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { audit } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";

/** DELETE /api/dashboard/api-tokens/[id] — revokes a token. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardPermission("apiTokensManage", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;
  const token = await prisma.apiToken.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!token) return jsonError("Token not found.", 404);
  await prisma.apiToken.delete({ where: { id: token.id } });
  await audit(prisma, ctx, "api_token.revoked", `${token.name} (${token.tokenPrefix}…)`);
  return NextResponse.json({ ok: true });
}
