import type { Metadata } from "next";
import Link from "next/link";
import { LearningCard } from "@/components/dashboard/pages/LearningCard";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { LEARNING_SECTIONS, learningStats } from "@/lib/learning";
import { readSettings, requireOrgContext, trialDaysLeft } from "@/lib/tenant";

export const metadata: Metadata = { title: "Learning" };
export const dynamic = "force-dynamic";

export default async function DashboardLearningPage() {
  const ctx = await requireOrgContext();
  const progress = readSettings(ctx.org).learning ?? {};
  const stats = learningStats(progress);
  return (
    <div className="space-y-8">
      <PageHeader
        kicker="LEARNING HUB"
        title="Learning"
        description={`Guides and tutorials from the ContextQA Learning Hub, launched directly in ${ctx.org.name}. Trial · ${trialDaysLeft(ctx.org)} days left.`}
        actions={
          <Link href="/learning" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            Public portal
          </Link>
        }
      />
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-3xl font-semibold text-slate-900">{stats.pct}%</p>
          <div className="min-w-48 flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${stats.pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{stats.done}/{stats.total} modules completed · {stats.inProgress} in progress</p>
          </div>
        </div>
      </Card>
      {LEARNING_SECTIONS.map((section) => (
        <section key={section.name}>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-900 uppercase">{section.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {section.modules.map((mod) => (
              <LearningCard key={mod.id} mod={mod} status={progress[mod.id]?.status} readOnly={ctx.readOnly} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
