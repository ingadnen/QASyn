import type { Metadata } from "next";
import { SuperAdminConsole } from "@/components/dashboard/pages/SuperAdminConsole";
import { requirePermission } from "@/lib/rbac-server";

export const metadata: Metadata = { title: "Super Admin" };
export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  await requirePermission("settingsManage");
  return (
    <div>
      <h1 className="text-[20px] font-semibold text-[#101828]">Super-Admin Master Control Plane</h1>
      <p className="mt-1 text-[13px] text-[#6b7280]">Tenants, users, credits, AI models and platform-wide skills.</p>
      <SuperAdminConsole />
    </div>
  );
}
