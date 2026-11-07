import { redirect } from "next/navigation";
import { SplitLayout } from "@/components/layout/SplitLayout";
import { OnboardingAside } from "@/components/onboarding/DashboardPreview";
import { requireOwnOrganisation } from "@/lib/auth";
import { OnboardingProvider } from "@/lib/context/OnboardingContext";
import { loadOnboardingState } from "@/lib/onboarding-state";

export const dynamic = "force-dynamic";

/** Onboarding shell: own organisation only (never the demo), state loaded from SQLite. */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOwnOrganisation();
  const state = await loadOnboardingState(session.org.id);
  if (!state) redirect("/onboard/organisation");
  if (state.completed) redirect("/dashboard/overview");

  return (
    <OnboardingProvider initialState={state}>
      <SplitLayout aside={<OnboardingAside />} wide header={<span className="text-xs text-muted">{session.user.email}</span>}>
        {children}
      </SplitLayout>
    </OnboardingProvider>
  );
}
