import { NextResponse } from "next/server";
import { getSession, setActiveOrganisation } from "@/lib/auth";
import { DEMO_ORG_SLUG } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { switchOrgSchema } from "@/lib/validation";

/** POST /api/auth/switch { target: "own" | "demo" } — one-click switch between own org and the demo. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user.emailVerifiedAt) return jsonError("Sign in to continue.", 401);

  const parsed = switchOrgSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.target === "demo") {
    const demo = await prisma.organisation.findFirst({ where: { slug: DEMO_ORG_SLUG, isMockDemo: true }, select: { id: true } });
    if (!demo) return jsonError("Demo workspace not found. Run `npm run db:seed`.", 404);
    await setActiveOrganisation(session.sessionId, demo.id);
    return NextResponse.json({ next: "/dashboard/overview" });
  }

  if (!session.user.organisationId) {
    await setActiveOrganisation(session.sessionId, null);
    return NextResponse.json({ next: "/onboard/organisation" });
  }
  await setActiveOrganisation(session.sessionId, session.user.organisationId);
  return NextResponse.json({ next: "/dashboard/overview" });
}
