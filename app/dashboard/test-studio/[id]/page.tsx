import { requirePermission } from "@/lib/rbac-server";
import StudioPage, { metadata } from "@/components/dashboard/pages/StudioPage";

export { metadata };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <StudioPage params={params} />;
}
