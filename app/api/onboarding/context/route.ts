import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { loadOnboardingState } from "@/lib/onboarding-state";
import { getCurrentOrgId } from "@/lib/session";
import { hostOf } from "@/lib/utils";

/**
 * GET /api/onboarding/context
 * Remplacement local de l'appel distant `/api/v2/onboarding/context` (404 Unknown Error) :
 * renvoie le contexte de l'espace de travail affiché dans l'aperçu.
 */
export async function GET() {
  const organisationId = await getCurrentOrgId();
  if (!organisationId) return jsonError("No organisation in session.", 401);

  const state = await loadOnboardingState(organisationId);
  if (!state) return jsonError("Organisation not found.", 404);

  return NextResponse.json(
    {
      workspace: {
        name: state.organisation.name,
        slug: state.organisation.slug,
        environment:
          state.reachType === "LOCALHOST"
            ? `localhost:${state.localPort}`
            : hostOf(state.environmentUrl || state.organisation.website),
        focus: state.focus,
        integrations: state.integrations,
        team: state.teamInvites.length + 1,
        currentStep: state.currentStep,
        completed: state.completed,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
