import type { Metadata } from "next";
import Link from "next/link";
import { StudioClient, type StudioStep } from "@/components/dashboard/pages/StudioClient";
import { PageHeader, StatusPill } from "@/components/dashboard/ui";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Test Case Studio" };
export const dynamic = "force-dynamic";

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const tc = await prisma.testCase.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!tc) notFound();
  let steps: StudioStep[] = [];
  try {
    steps = JSON.parse(tc.stepsJson || "[]");
  } catch {
    steps = [];
  }
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="WEB TESTING · TEST STEPS EDITOR"
        title={tc.title}
        description={`${tc.module} · ${tc.criticality} · ${tc.stepsCount} step${tc.stepsCount === 1 ? "" : "s"} · status: ${tc.status}`}
        actions={
          <>
            <StatusPill value={tc.status} />
            <Link href="/dashboard/test-cases" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              ← All test cases
            </Link>
          </>
        }
      />
      <StudioClient testCaseId={tc.id} initialSteps={steps} readOnly={ctx.readOnly} />
    </div>
  );
}
