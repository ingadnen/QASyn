import { NextResponse } from "next/server";
import { getSession, initialsOf, setActiveOrganisation } from "@/lib/auth";
import { TRIAL_CREDITS, TRIAL_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { startCrawl } from "@/lib/engine";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { checkSlugAvailability } from "@/lib/organisations";
import { audit } from "@/lib/tenant";
import { delay, hostOf, slugify } from "@/lib/utils";
import { createOrganisationSchema } from "@/lib/validation";

/**
 * POST /api/onboard — creates the user's organisation (trial starts now) and its onboarding row.
 * If a website is given with "Add website to Knowledge Base", a crawl session starts immediately.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to continue.", 401);
  if (!session.user.emailVerifiedAt) return jsonError("Verify your e-mail first.", 403);
  if (session.user.organisationId) return jsonError("You already belong to an organisation.", 409, { next: "/dashboard/overview" });

  const parsed = createOrganisationSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  await delay(MOCK_LATENCY_MS);

  const slug = slugify(input.slug || input.name);
  const availability = await checkSlugAvailability(slug);
  if (!availability.available) {
    return jsonError(
      availability.reason === "invalid" ? "Use at least 3 letters or numbers." : "This organisation name is already taken.",
      409,
      { suggestion: availability.suggestion },
    );
  }

  const user = session.user;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organisation.create({
      data: {
        name: input.name,
        slug,
        ownerName: input.ownerName,
        website: input.website,
        logoUrl: input.logoUrl ?? null,
        addToKnowledgeBase: input.addToKnowledgeBase,
        trialEndsAt,
        trialCredits: TRIAL_CREDITS,
        onboarding: { create: { currentStep: 1 } },
      },
    });
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: { organisationId: created.id, name: input.ownerName, avatarInitials: initialsOf(input.ownerName, user.email), role: "Admin" },
    });
    const actor = { org: created, user: updatedUser };
    await audit(tx, actor, "organisation.created", created.slug);

    if (input.website && input.addToKnowledgeBase) {
      await tx.knowledgeItem.create({
        data: { organisationId: created.id, title: hostOf(input.website) ?? input.website, type: "website", urlOrPath: input.website, status: "indexing" },
      });
      await startCrawl(tx, actor, input.website);
    }
    return created;
  });

  await setActiveOrganisation(session.sessionId, org.id);
  return NextResponse.json({ organisation: { id: org.id, slug: org.slug }, next: "/onboarding/1" }, { status: 201 });
}
