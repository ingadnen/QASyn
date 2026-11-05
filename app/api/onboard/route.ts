import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { loadOnboardingState } from "@/lib/onboarding-state";
import { checkSlugAvailability } from "@/lib/organisations";
import { setCurrentOrg } from "@/lib/session";
import { delay, slugify } from "@/lib/utils";
import { createOrganisationSchema } from "@/lib/validation";

/**
 * POST /api/onboard — crée l'organisation (INSERT Organisation + Onboarding),
 * place son id dans le cookie de session et renvoie l'état initial.
 */
export async function POST(request: Request) {
  const parsed = createOrganisationSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const { ownerName, name, website, addWebsiteToKb } = parsed.data;
  const slug = parsed.data.slug || slugify(name);

  // Latence simulée → bouton "Creating organisation…"
  await delay(MOCK_LATENCY_MS);

  const availability = await checkSlugAvailability(slug);
  if (!availability.available) {
    const message =
      availability.reason === "invalid"
        ? "Organisation name must contain at least 3 letters or numbers."
        : `“${slug}” is not available.`;
    return jsonError(message, availability.reason === "invalid" ? 400 : 409, {
      slug,
      suggestion: availability.suggestion,
    });
  }

  let organisationId: string;
  try {
    const org = await prisma.organisation.create({
      data: { name, slug, ownerName, website, addWebsiteToKb, onboarding: { create: {} } },
      select: { id: true },
    });
    organisationId = org.id;
  } catch (error) {
    // Course entre deux créations simultanées sur le même slug
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(`“${slug}” is not available.`, 409, { slug, suggestion: null });
    }
    throw error;
  }

  await setCurrentOrg(organisationId);
  const state = await loadOnboardingState(organisationId);

  return NextResponse.json({ state, next: "/onboarding/1" }, { status: 200 });
}
