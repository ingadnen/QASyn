import { requirePermission } from "@/lib/rbac-server";
import type { Metadata } from "next";
import { Tunnels } from "@/components/dashboard/pages/TunnelsParity";
import { prisma } from "@/lib/db";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Tunnels" };
export const dynamic = "force-dynamic";

export default async function TunnelsPage() {
  const ctx = await requirePermission("tunnels");
  const machines = await prisma.tunnelMachine.findMany({
    where: { organisationId: ctx.org.id },
    orderBy: { createdAt: "asc" },
  });
  const settings = readSettings(ctx.org);
  const storedAlerts = settings.tunnelAlerts;
  const alerts = {
    sendAlerts: storedAlerts?.sendAlerts ?? true,
    delivery: storedAlerts?.delivery ?? ("Immediate" as const),
    digestHour: storedAlerts?.digestHour ?? "09:00",
    channel: storedAlerts?.channel ?? "",
    recipients: storedAlerts?.recipients?.length ? storedAlerts.recipients : [ctx.user.email],
  };

  return (
    <Tunnels
      readOnly={ctx.readOnly}
      orgName={ctx.org.name}
      maxMachines={5}
      maxRoutes={15}
      alerts={alerts}
      machines={machines.map((machine) => ({
        id: machine.id,
        name: machine.name,
        os: machine.os,
        status: machine.status,
        browserHost: machine.browserHost,
        routeCount: machine.routeCount,
        createdAt: machine.createdAt.toISOString(),
      }))}
    />
  );
}
