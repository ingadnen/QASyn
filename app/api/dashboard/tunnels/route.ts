import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { audit, guardApi, readSettings, writeSettings } from "@/lib/tenant";
import { randomToken } from "@/lib/crypto";

const MACHINE_NAME = /^[a-z][a-z0-9-]{0,20}$/;
const MAX_MACHINES = 5;

const createSchema = z.object({
  name: z.string().trim().toLowerCase().regex(MACHINE_NAME, "Use lowercase letters, digits and hyphens, starting with a letter, up to 21 characters."),
  os: z.enum(["win", "mac", "linux"]).default("win"),
  browserHost: z.boolean().default(false),
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("renew"), id: z.string().min(1).max(60) }),
  z.object({
    action: z.literal("alerts"),
    sendAlerts: z.boolean(),
    delivery: z.enum(["Immediate", "Daily digest"]),
    digestHour: z.string().max(10),
    channel: z.string().max(120),
  }),
]);

/** GET /api/dashboard/tunnels — machine list (used by the client after mutations). */
export async function GET() {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const machines = await prisma.tunnelMachine.findMany({
    where: { organisationId: guard.ctx.org.id },
    orderBy: [{ status: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ machines });
}

/** POST /api/dashboard/tunnels — reserve a machine and mint a one-time install token. */
export async function POST(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  const existing = await prisma.tunnelMachine.findFirst({
    where: { organisationId: ctx.org.id, name: parsed.data.name },
  });
  if (existing) return jsonError("A machine with this name already exists.", 409);

  const total = await prisma.tunnelMachine.count({ where: { organisationId: ctx.org.id } });
  if (total >= MAX_MACHINES) return jsonError(`Your plan allows ${MAX_MACHINES} machines. Remove one first.`, 409);

  const token = `cqa_tun_${randomToken(18)}`;
  const machine = await prisma.tunnelMachine.create({
    data: {
      organisationId: ctx.org.id,
      name: parsed.data.name,
      os: parsed.data.os,
      browserHost: parsed.data.browserHost,
      status: "pending",
      token,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  await audit(prisma, ctx, "tunnel.machine_created", machine.name);
  return NextResponse.json({ machine }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

/** PATCH /api/dashboard/tunnels — renew an expired command, or save alert delivery. */
export async function PATCH(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  if (input.action === "alerts") {
    await writeSettings(prisma, ctx.org, {
      tunnelAlerts: {
        sendAlerts: input.sendAlerts,
        delivery: input.delivery,
        digestHour: input.digestHour,
        channel: input.channel,
      },
    });
    await audit(prisma, ctx, "tunnel.alerts_updated", input.delivery);
    return NextResponse.json({ ok: true });
  }

  const machine = await prisma.tunnelMachine.findFirst({ where: { id: input.id, organisationId: ctx.org.id } });
  if (!machine) return jsonError("Machine not found.", 404);
  const token = `cqa_tun_${randomToken(18)}`;
  const updated = await prisma.tunnelMachine.update({
    where: { id: machine.id },
    data: { token, status: "pending", expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  await audit(prisma, ctx, "tunnel.command_renewed", machine.name);
  return NextResponse.json({ machine: updated }, { headers: { "Cache-Control": "no-store" } });
}

/** DELETE /api/dashboard/tunnels?id=… — remove a machine. */
export async function DELETE(request: Request) {
  const guard = await guardApi({ write: true });
  if (!guard.ok) return guard.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return jsonError("id is required.", 400);
  const machine = await prisma.tunnelMachine.findFirst({ where: { id, organisationId: guard.ctx.org.id } });
  if (!machine) return jsonError("Machine not found.", 404);
  await prisma.tunnelMachine.delete({ where: { id: machine.id } });
  await audit(prisma, guard.ctx, "tunnel.machine_removed", machine.name);
  return NextResponse.json({ ok: true });
}

/** Read settings helper for server pages. */
export function tunnelAlertSettings(org: { settingsJson: string }) {
  const settings = readSettings(org) as { tunnelAlerts?: { sendAlerts?: boolean; delivery?: "Immediate" | "Daily digest"; digestHour?: string; channel?: string } };
  return settings.tunnelAlerts ?? { sendAlerts: true, delivery: "Immediate" as const, digestHour: "09:00", channel: "" };
}
