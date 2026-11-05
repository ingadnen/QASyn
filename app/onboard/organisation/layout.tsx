import Link from "next/link";
import { SplitLayout } from "@/components/layout/SplitLayout";
import { WorkspacePreviewCard } from "@/components/sections/onboard/WorkspacePreviewCard";
import { OnboardingProvider } from "@/lib/context/OnboardingContext";

export default function OrganisationLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <SplitLayout
        aside={<WorkspacePreviewCard />}
        header={
          <Link href="/dashboard/overview" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            View demo dashboard →
          </Link>
        }
      >
        {children}
      </SplitLayout>
    </OnboardingProvider>
  );
}
