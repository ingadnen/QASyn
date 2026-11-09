import type { Metadata } from "next";
import { BillingUsage } from "@/components/dashboard/pages/BillingUsage";
import { prisma } from "@/lib/db";
import { ensureCreditLedger } from "@/lib/credits";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const ctx = await requireOrgContext();
  await ensureCreditLedger(ctx.org);
  const entries = await prisma.creditEntry.findMany({
    where: { organisationId: ctx.org.id },
    orderBy: { occurredAt: "desc" },
  });

  return (
    <BillingUsage
      view="billing"
      orgName={ctx.org.name}
      plan={ctx.org.plan}
      readOnly={ctx.readOnly}
      trialCredits={ctx.org.trialCredits}
      creditsUsed={ctx.org.creditsUsed}
      paymentMethod={ctx.org.paymentMethod}
      trialStartsAt={ctx.org.trialStartsAt.toISOString()}
      trialEndsAt={ctx.org.trialEndsAt.toISOString()}
      entries={entries.map((entry) => ({
        id: entry.id,
        occurredAt: entry.occurredAt.toISOString(),
        action: entry.action,
        credits: entry.credits,
        kind: entry.kind,
        note: entry.note,
      }))}
    />
  );
}
