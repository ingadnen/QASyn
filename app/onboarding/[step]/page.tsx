import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OnboardingStep } from "@/components/sections/onboarding/OnboardingStep";
import { STEPS, TOTAL_STEPS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/session";

type PageProps = { params: Promise<{ step: string }> };

function parseStep(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_STEPS ? n : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const step = parseStep((await params).step);
  return { title: step ? `${STEPS[step - 1].label} · Onboarding` : "Onboarding" };
}

/**
 * Cible D — /onboarding/[step] (1 → 7)
 * Garde d'accès : impossible de sauter à une étape non débloquée (currentStep en base).
 */
export default async function OnboardingStepPage({ params }: PageProps) {
  const step = parseStep((await params).step);
  if (!step) notFound();

  const organisationId = await getCurrentOrgId();
  const onboarding = organisationId
    ? await prisma.onboarding.findUnique({
        where: { organisationId },
        select: { currentStep: true, completedAt: true },
      })
    : null;
  if (!onboarding) redirect("/onboard/organisation");
  if (!onboarding.completedAt && step > onboarding.currentStep) redirect(`/onboarding/${onboarding.currentStep}`);

  return <OnboardingStep step={step} />;
}
