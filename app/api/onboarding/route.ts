import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { TOTAL_STEPS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { loadOnboardingState } from "@/lib/onboarding-state";
import { createDemoRuns } from "@/lib/runs";
import { getCurrentOrgId } from "@/lib/session";
import { generateTunnelToken } from "@/lib/tokens";
import { delay, normalizeWebsite } from "@/lib/utils";
import { stepPayloadSchema } from "@/lib/validation";

const NO_SESSION = "No organisation in session. Create one first.";

/** GET /api/onboarding — état complet de l'onboarding de l'organisation courante. */
export async function GET() {
  const organisationId = await getCurrentOrgId();
  if (!organisationId) return jsonError(NO_SESSION, 401);

  const state = await loadOnboardingState(organisationId);
  if (!state) return jsonError("Organisation not found.", 404);

  return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * PATCH /api/onboarding — enregistre une étape ("Continue") :
 * UPDATE Onboarding + avance currentStep. À l'étape 7, INSERT de l'historique
 * de runs (TestRun + LogLine) qui alimente le tableau de bord.
 */
export async function PATCH(request: Request) {
  const organisationId = await getCurrentOrgId();
  if (!organisationId) return jsonError(NO_SESSION, 401);

  const parsed = stepPayloadSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const payload = parsed.data;

  await delay(MOCK_LATENCY_MS);

  const onboarding = await prisma.onboarding.findUnique({
    where: { organisationId },
    include: { organisation: { select: { slug: true } } },
  });
  if (!onboarding) return jsonError("Onboarding not found.", 404);
  if (payload.step > onboarding.currentStep) {
    return jsonError(`Complete step ${onboarding.currentStep} first.`, 409);
  }

  let data: Prisma.OnboardingUpdateInput = {};
  switch (payload.step) {
    case 1:
      data = { appDescription: payload.appDescription };
      break;
    case 2: {
      if (payload.reachType === "TEAM_ENV") {
        const environmentUrl = normalizeWebsite(payload.environmentUrl ?? "");
        if (!environmentUrl) return jsonError("Enter the URL of your staging or QA environment.", 400);
        data = { reachType: "TEAM_ENV", environmentUrl };
      } else {
        if (!payload.selectedOs) return jsonError("Choose your operating system.", 400);
        data = {
          reachType: "LOCALHOST",
          selectedOs: payload.selectedOs,
          localPort: payload.localPort ?? 3000,
          tunnelToken: onboarding.tunnelToken ?? generateTunnelToken(),
        };
      }
      break;
    }
    case 3:
    case 4:
      // Les intégrations sont enregistrées par /api/onboarding/integrations/[provider]
      break;
    case 5:
      data = { focus: payload.focus };
      break;
    case 6:
      data = { teamInvites: [...new Set(payload.teamInvites)].join("\n") || null };
      break;
    case 7:
      data = { completedAt: onboarding.completedAt ?? new Date() };
      break;
  }

  const currentStep = Math.min(TOTAL_STEPS, Math.max(onboarding.currentStep, payload.step + 1));

  await prisma.$transaction(async (tx) => {
    await tx.onboarding.update({ where: { id: onboarding.id }, data: { ...data, currentStep } });

    if (payload.step === TOTAL_STEPS) {
      const existingRuns = await tx.testRun.count({ where: { organisationId } });
      if (existingRuns === 0) {
        await createDemoRuns(tx, organisationId, `${onboarding.organisation.slug} / app`);
      }
    }
  });

  const state = await loadOnboardingState(organisationId);
  const next = payload.step < TOTAL_STEPS ? `/onboarding/${payload.step + 1}` : "/dashboard/overview";
  return NextResponse.json({ state, next });
}
