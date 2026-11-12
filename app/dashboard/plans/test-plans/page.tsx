import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { CreateCollectionButton } from "@/components/dashboard/pages/CreateCollectionButton";
import { PlansList, type PlanRow } from "@/components/dashboard/pages/PlansList";
import { CqaIcon, PageHeader, StatusPill } from "@/components/dashboard/ui";
import { TableShell, Td, Tr } from "@/components/contextqa/workspace";
import { prisma } from "@/lib/db";
import { syncPlanLinks } from "@/lib/plan-sync";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Test plans" };
export const dynamic = "force-dynamic";

export default async function TestPlansPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requirePermission("plans");
  await syncPlanLinks(prisma, ctx.org.id);
  const { tab = "plans" } = await searchParams;
  const [plans, schedules, suites] = await Promise.all([
    prisma.testPlan.findMany({
      where: { organisationId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { testCases: true, suites: true } } },
    }),
    prisma.schedule.findMany({ where: { organisationId: ctx.org.id }, orderBy: { createdAt: "desc" } }),
    prisma.testSuite.count({ where: { organisationId: ctx.org.id } }),
  ]);
  const running = plans.filter((p) => p.lastRunAt && Date.now() - p.lastRunAt.getTime() < 60_000).length;
  const planRows: PlanRow[] = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    module: plan.module,
    environment: plan.environment ?? "",
    schedule: plan.schedule,
    suites: plan._count.suites,
    cases: plan.testCasesCount || plan._count.testCases,
    passRate: plan.passRate,
    lastRunAt: plan.lastRunAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
  }));
  return (
    <div className="space-y-4">
      <PageHeader title="Test Plans" description="Group test suites into plans and execute them across environments, devices, and schedules" />

      <div className="flex flex-wrap items-center gap-4 rounded-[11px] border border-[#e5e7eb] bg-white px-4 py-2.5 text-[12.5px] text-[#4b5563] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="inline-flex items-center gap-1.5 font-medium text-[#111827]">
          <CqaIcon name="corporate_fare" className="text-[17px] text-[#6b7280]" /> {ctx.org.name}
        </span>
        <span className="inline-flex items-center gap-1.5"><CqaIcon name="sync" className="text-[16px] text-[#6b7280]" /> Running <strong className="text-[#111827]">{running}</strong></span>
        <span className="inline-flex items-center gap-1.5"><CqaIcon name="layers" className="text-[16px] text-[#6b7280]" /> Capacity <strong className="text-[#111827]">{Math.max(5, suites)}</strong></span>
        <span className="inline-flex items-center gap-1.5"><CqaIcon name="schedule" className="text-[16px] text-[#6b7280]" /> Queued <strong className="text-[#111827]">0</strong></span>
        <span className="ml-auto text-[11.5px] text-[#9ca3af]">0/{Math.max(5, suites)}</span>
      </div>

      <div className="flex items-center gap-6 border-b border-[#e5e7eb]">
        <a href="/dashboard/plans/test-plans" className={`-mb-px border-b-2 pb-2.5 pt-1 text-[13px] ${tab === "plans" ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280]"}`}>
          Test Plans ({plans.length})
        </a>
        <a href="/dashboard/plans/test-plans?tab=schedules" className={`-mb-px border-b-2 pb-2.5 pt-1 text-[13px] ${tab === "schedules" ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280]"}`}>
          Schedules ({schedules.length})
        </a>
      </div>

      {tab === "schedules" ? (
        <TableShell headers={["Name", "Test Plan", "Cron", "Time zone", "Enabled", "Next fire"]} footer={<span className="tabular-nums">1–{schedules.length} of {schedules.length}</span>}>
          {schedules.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-14 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#f3f4f6] text-[#9ca3af]"><CqaIcon name="schedule" className="text-[24px]" /></div>
                <p className="mt-2 text-[14px] font-medium text-[#374151]">No schedules yet</p>
                <p className="mt-1 text-[12.5px] text-[#9ca3af]">Use Schedule on a test plan to run it automatically.</p>
              </td>
            </tr>
          )}
          {schedules.map((s) => {
            const plan = plans.find((p) => p.id === s.testPlanId);
            return (
              <Tr key={s.id}>
                <Td className="font-medium text-[#1f2937]">{s.name}</Td>
                <Td className="text-[#4b5563]">{plan?.name ?? "-"}</Td>
                <Td><code className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[11.5px]">{s.cronExpression}</code></Td>
                <Td className="text-[#4b5563]">{s.timezone}</Td>
                <Td><StatusPill value={s.enabled ? "active" : "off"} label={s.enabled ? "Enabled" : "Disabled"} /></Td>
                <Td className="text-[#6b7280]">{s.nextFireAt ? s.nextFireAt.toLocaleString("en-GB") : "-"}</Td>
              </Tr>
            );
          })}
        </TableShell>
      ) : (
        <PlansList
          rows={planRows}
          readOnly={ctx.readOnly}
          actions={<CreateCollectionButton kind="test-plans" readOnly={ctx.readOnly} label="New Test Plan" defaultEmail={ctx.user.email} />}
        />
      )}
    </div>
  );
}
