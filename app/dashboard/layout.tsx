import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { FinQAWidget } from "@/components/sections/FinQAWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <DashboardSidebar />
      <div className="min-w-0 flex-1">{children}</div>
      <FinQAWidget />
    </div>
  );
}
