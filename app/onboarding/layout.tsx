import Link from "next/link";
import { redirect } from "next/navigation";
import { SplitLayout } from "@/components/layout/SplitLayout";
import { Stepper } from "@/components/sections/onboarding/Stepper";
import { WorkspacePreviewCard } from "@/components/sections/onboard/WorkspacePreviewCard";
import { OnboardingProvider } from "@/lib/context/OnboardingContext";
import { loadOnboardingState } from "@/lib/onboarding-state";
import { getCurrentOrgId } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Layout du tunnel : charge l'état depuis SQLite (SELECT) et hydrate OnboardingContext.
 * Le layout persiste entre les étapes : le contexte est ensuite mis à jour
 * par les réponses de PATCH /api/onboarding.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const organisationId = await getCurrentOrgId();
  const state = organisationId ? await loadOnboardingState(organisationId) : null;
  if (!state) redirect("/onboard/organisation");

  return (
    <OnboardingProvider initialState={state}>
      <SplitLayout
        wide
        aside={<WorkspacePreviewCard />}
        header={
          <Link href="/dashboard/overview" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            Skip to dashboard →
          </Link>
        }
      >
        <Stepper />
        <div className="mt-10">{children}</div>
      </SplitLayout>
    </OnboardingProvider>
  );
}
