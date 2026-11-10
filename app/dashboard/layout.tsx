import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { Toaster } from "@/components/dashboard/Toaster";
import { FinQAWidget } from "@/components/sections/FinQAWidget";
import { initialsOf } from "@/lib/auth";
import { ensureWal, prisma } from "@/lib/db";
import { settlePending } from "@/lib/engine";
import { requireOrgContext, trialDaysLeft } from "@/lib/tenant";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · QASyn" } };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrgContext();
  if (!ctx.readOnly) {
    const onboarding = await prisma.onboarding.findUnique({ where: { organisationId: ctx.org.id }, select: { completedAt: true, currentStep: true } });
    if (onboarding && !onboarding.completedAt) redirect(`/onboarding/${onboarding.currentStep}`);
  }
  await settlePending(ctx.org.id);
  void ensureWal();

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <DashboardSidebar
        orgName={ctx.org.name}
        logoUrl={ctx.org.logoUrl}
        isDemo={ctx.org.isMockDemo}
        readOnly={ctx.readOnly}
        trialDaysLeft={trialDaysLeft(ctx.org)}
        plan={ctx.org.plan}
        ownOrgName={ctx.ownOrg?.name ?? null}
        user={{ name: ctx.user.name, email: ctx.user.email, initials: ctx.user.avatarInitials || initialsOf(ctx.user.name, ctx.user.email) }}
      />
      <div className="min-w-0 flex-1">
        {ctx.readOnly && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[11px] text-amber-900">
            <span>
              You&apos;re viewing the <strong>{ctx.org.name}</strong> demo workspace (mock data, read-only).
            </span>
            {ctx.ownOrg ? (
              <span>Use the profile menu to switch back to {ctx.ownOrg.name}.</span>
            ) : (
              <Link href="/onboard/organisation" className="font-semibold underline">
                Create your organisation
              </Link>
            )}
          </div>
        )}
        <main className="min-h-[calc(100vh-40px)] bg-[#f7f8fa] px-6 py-5 lg:px-8">{children}</main>
      </div>
      <FinQAWidget />
      <Toaster />
    </div>
  );
}
