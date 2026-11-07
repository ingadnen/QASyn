import { redirect } from "next/navigation";
import { requireOwnOrganisation } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OnboardingIndex() {
  const { org } = await requireOwnOrganisation();
  const onboarding = await prisma.onboarding.findUnique({ where: { organisationId: org.id }, select: { currentStep: true } });
  redirect(`/onboarding/${onboarding?.currentStep ?? 1}`);
}
