import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Step1Building } from "@/components/onboarding/Step1Building";
import { Step2Context } from "@/components/onboarding/Step2Context";
import { Step3Code, Step4Tools } from "@/components/onboarding/StepIntegrations";
import { Step5Focus } from "@/components/onboarding/Step5Focus";
import { Step6Team } from "@/components/onboarding/Step6Team";
import { Step7Trial } from "@/components/onboarding/Step7Trial";
import { requireOwnOrganisation } from "@/lib/auth";
import { STEPS, TOTAL_STEPS } from "@/lib/constants";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ step: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = Number((await params).step);
  const meta = STEPS[n - 1];
  return { title: meta ? `Step ${n} · ${meta.label}` : "Onboarding" };
}

const COMPONENTS = [Step1Building, Step2Context, Step3Code, Step4Tools, Step5Focus, Step6Team, Step7Trial];

export default async function OnboardingStepPage({ params }: Props) {
  const raw = (await params).step;
  const step = Number(raw);
  if (!/^\d$/.test(raw) || step < 1 || step > TOTAL_STEPS) notFound();

  const { org } = await requireOwnOrganisation();
  const onboarding = await prisma.onboarding.findUnique({ where: { organisationId: org.id }, select: { currentStep: true } });
  const current = onboarding?.currentStep ?? 1;
  if (step > current) redirect(`/onboarding/${current}`);

  const Step = COMPONENTS[step - 1];
  return <Step />;
}
