import { NextResponse } from "next/server";
import { z } from "zod";
import { destroySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardApi } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { updateOrganisationSchema } from "@/lib/validation";

/** PATCH /api/dashboard/settings/organization — name, website, logo, KB flag. */
export async function PATCH(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = updateOrganisationSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const { name, website, logoUrl, addToKnowledgeBase } = parsed.data;

  await delay(MOCK_LATENCY_MS / 2);
  const org = await prisma.organisation.update({
    where: { id: ctx.org.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      website,
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(addToKnowledgeBase !== undefined ? { addToKnowledgeBase } : {}),
    },
    select: { id: true, name: true, website: true },
  });
  await audit(prisma, ctx, "organisation.updated", org.name);
  return NextResponse.json({ organisation: org });
}

const deleteSchema = z.object({ confirm: z.string().max(60) });

/** DELETE /api/dashboard/settings/organization { confirm: slug } — irreversible; never allowed on the demo. */
export async function DELETE(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (ctx.org.isMockDemo) return jsonError("The demo workspace can't be deleted.", 403);

  const parsed = deleteSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.confirm !== ctx.org.slug) return jsonError(`Type "${ctx.org.slug}" to confirm.`, 400);

  await delay(MOCK_LATENCY_MS);
  await prisma.$transaction([
    // Pending invitations of this organisation have no account: remove them.
    prisma.user.deleteMany({ where: { organisationId: ctx.org.id, status: "invited", passwordHash: null } }),
    prisma.session.updateMany({ where: { activeOrganisationId: ctx.org.id }, data: { activeOrganisationId: null } }),
    prisma.organisation.delete({ where: { id: ctx.org.id } }),
  ]);
  await destroySession();
  return NextResponse.json({ next: "/login" });
}
