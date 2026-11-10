import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Test Studio" };
export const dynamic = "force-dynamic";

export default async function TestStudioIndexPage() {
  const ctx = await requirePermission("testCases");
  const cases = await prisma.testCase.findMany({ where: { organisationId: ctx.org.id }, orderBy: { title: "asc" }, select: { id: true, title: true } });
  return (
    <div className="space-y-6">
      <PageHeader kicker="TESTING STUDIO" title="Test Studio" description="Pick a test case to open the full visual editor." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {cases.map((c) => (
          <li key={c.id}>
            <Link href={`/dashboard/test-studio/${c.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 font-medium text-brand-700 shadow-sm hover:border-brand-300">
              {c.title}
            </Link>
          </li>
        ))}
      </ul>
      {cases.length === 0 && <p className="text-sm text-slate-500">No test cases yet. Create one in Test cases first.</p>}
    </div>
  );
}
