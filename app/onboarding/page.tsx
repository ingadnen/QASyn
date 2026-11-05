import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/session";

/** /onboarding → reprend à l'étape débloquée la plus avancée. */
export default async function OnboardingIndex() {
  const organisationId = await getCurrentOrgId();
  const onboarding = organisationId
    ? await prisma.onboarding.findUnique({ where: { organisationId }, select: { currentStep: true } })
    : null;
  redirect(onboarding ? `/onboarding/${onboarding.currentStep}` : "/onboard/organisation");
}
