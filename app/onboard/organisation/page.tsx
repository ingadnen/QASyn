import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SplitLayout } from "@/components/layout/SplitLayout";
import { OrganisationForm } from "@/components/onboarding/OrganisationForm";
import { WorkspacePreviewCard } from "@/components/onboarding/WorkspacePreviewCard";
import { requireUser } from "@/lib/auth";
import { PUBLIC_EMAIL_DOMAINS } from "@/lib/constants";
import { EMPTY_ONBOARDING_STATE, OnboardingProvider } from "@/lib/context/OnboardingContext";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Create your organisation" };
export const dynamic = "force-dynamic";

export default async function OrganisationPage() {
  const session = await requireUser();
  if (session.user.organisationId) redirect("/onboarding/1");

  const domain = session.user.email.split("@")[1]?.toLowerCase() ?? "";
  const existing =
    domain && !PUBLIC_EMAIL_DOMAINS.has(domain)
      ? await prisma.organisation.findFirst({
          where: { users: { some: { email: { endsWith: `@${domain}` }, id: { not: session.user.id } } } },
          select: { name: true },
        })
      : null;

  const defaultName = session.user.name && session.user.name !== session.user.email ? session.user.name : "";

  return (
    <OnboardingProvider initialState={EMPTY_ONBOARDING_STATE}>
      <SplitLayout aside={<WorkspacePreviewCard />} header={<span className="text-xs text-muted">{session.user.email}</span>}>
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            ✓ Email verified.
          </p>
          {existing && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Already using {existing.name}?</p>
              <p className="mt-1 text-amber-800">
                Someone from <span className="font-medium">@{domain}</span> already has a QASyn workspace. Its admins have been emailed to
                invite you. You can also create a separate organisation below.
              </p>
            </div>
          )}
          <OrganisationForm defaultName={defaultName} />
        </div>
      </SplitLayout>
    </OnboardingProvider>
  );
}
