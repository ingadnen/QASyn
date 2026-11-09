import type { Metadata } from "next";
import { Tunnels } from "@/components/dashboard/pages/TunnelsParity";
import { prisma } from "@/lib/db";
import { readSettings, requireOrgContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Tunnels" };
export const dynamic = "force-dynamic";

export default async function TunnelsPage() {
  const ctx = await requireOrgContext();
  const machines = await prisma.tunnelMachine.findMany({
    where: { organisationId: ctx.org.id },
    orderBy: { createdAt: "asc" },
  });
  const settings = readSettings(ctx.org);
  const alerts = settings.tunnelAlerts ?? {
    sendAlerts: true,
    delivery: "Immediate" as const,
    digestHour: "09:00",
    channel: "",
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
