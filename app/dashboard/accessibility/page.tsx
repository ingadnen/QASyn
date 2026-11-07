import type { Metadata } from "next";
import { A11yForm } from "@/components/dashboard/pages/A11yClient";
import { Card, PageHeader } from "@/components/dashboard/ui";
import { requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Accessibility" };
export const dynamic = "force-dynamic";

export default async function AccessibilityPage() {
  const ctx = await requireOrgContext();
  return (
    <div className="space-y-6">
      <PageHeader kicker="ANALYTICS" title="Accessibility" description="WCAG 2.1 AA audit (axe-core style): image alt, labels, landmarks, button names, document title." />
      <Card title="Audit HTML">
        <div className="px-5 py-4"><A11yForm /></div>
      </Card>
    </div>
  );
}
