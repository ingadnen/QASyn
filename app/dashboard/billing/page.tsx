import type { Metadata } from "next";
import { BillingForm } from "@/components/dashboard/pages/Forms";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { requireOrgContext, trialDaysLeft } from "@/lib/tenant";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const ctx = await requireOrgContext();
  const credits = ctx.org.trialCredits - ctx.org.creditsUsed;
  const pct = ctx.org.trialCredits ? Math.round((credits / ctx.org.trialCredits) * 100) : 0;
  return (
    <div className="space-y-6">
      <PageHeader kicker="WORK" title="Billing & usage" description={`Plan: ${ctx.org.plan} · Trial · ${trialDaysLeft(ctx.org)} days left · ends ${ctx.org.trialEndsAt.toLocaleDateString()}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs font-medium text-slate-500">Credits remaining</p><p className="mt-1 text-2xl font-semibold">{credits.toLocaleString()} / {ctx.org.trialCredits.toLocaleString()}</p><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div></Card>
        <Card className="p-4"><p className="text-xs font-medium text-slate-500">Credits used</p><p className="mt-1 text-2xl font-semibold">{ctx.org.creditsUsed.toLocaleString()}</p></Card>
        <Card className="p-4"><p className="text-xs font-medium text-slate-500">Payment method</p><p className="mt-1 text-lg font-semibold">{ctx.org.paymentMethod ?? "None"}</p></Card>
      </div>
      <Card title="Plan & payment"><div className="px-5 py-4"><BillingForm plan={ctx.org.plan} paymentMethod={ctx.org.paymentMethod} readOnly={ctx.readOnly} /></div></Card>
    </div>
  );
}
