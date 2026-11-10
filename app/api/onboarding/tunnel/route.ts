import { NextResponse } from "next/server";
import { generateTunnelToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit, guardOwnOrg } from "@/lib/tenant";
import { delay } from "@/lib/utils";
import { tunnelActionSchema } from "@/lib/validation";

/** Accepts "Windows"/"windows"/"win", "macOS"/"mac", "Linux"/"linux". */
function normalizeTunnelOs(value: string | undefined): string | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (lower.startsWith("win")) return "win";
  if (lower.startsWith("mac") || lower === "darwin" || lower === "osx") return "mac";
  if (lower.startsWith("linux") || lower === "unix") return "linux";
  return null;
}

/**
 * POST /api/onboarding/tunnel
 *  - { action: "connect", name, token, os, hostname } → token-authenticated agent
 *    handshake, no session cookie required. Moves the machine Pending → Connected.
 *  - { action: "rotate" | "enroll" | "disconnect", localPort? } → cookie-authenticated
 *    onboarding tunnel controls for the user's own organisation.
 */
export async function POST(request: Request) {
  const parsed = tunnelActionSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.action === "connect") {
    const input = parsed.data;
    const machine = await prisma.tunnelMachine.findFirst({ where: { token: input.token } });
    if (!machine) return jsonError("Invalid tunnel token.", 401);
    if (machine.status === "expired" || machine.expiresAt.getTime() < Date.now()) {
      return jsonError("This install token has expired. Create a new command in Tunnels.", 410);
    }
    if (machine.name !== input.name) return jsonError("Token does not belong to this machine.", 403);
    const os = normalizeTunnelOs(input.os) ?? machine.os;
    const now = new Date();
    const updated = await prisma.tunnelMachine.update({
      where: { id: machine.id },
      data: {
        status: "connected",
        os,
        hostname: input.hostname || machine.hostname || machine.name,
        connectedAt: now,
        lastSeenAt: now,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const org = await prisma.organisation.findUnique({ where: { id: machine.organisationId }, select: { name: true, slug: true } });
    await prisma.systemAuditLog.create({
      data: {
        organisationId: machine.organisationId,
        actorEmail: "tunnel-agent@qasyn.local",
        action: "tunnel.connected",
        target: `${machine.name} · ${updated.hostname ?? machine.name} · ${os}`,
      },
    });
    return NextResponse.json({
      ok: true,
      machine: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        os: updated.os,
        hostname: updated.hostname,
        connectedAt: updated.connectedAt?.toISOString() ?? now.toISOString(),
      },
      organisation: org,
      origin: new URL(request.url).origin,
    });
  }

  const guard = await guardOwnOrg();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { action, localPort } = parsed.data;

  const onboarding = await prisma.onboarding.findUnique({ where: { organisationId: ctx.org.id } });
  if (!onboarding) return jsonError("Onboarding not found.", 404);

  await delay(action === "enroll" ? MOCK_LATENCY_MS * 2 : MOCK_LATENCY_MS / 2);

  let data: { tunnelToken?: string; tunnelEnrolled: boolean; localPort?: number; reachMode?: string };
  switch (action) {
    case "rotate":
      data = { tunnelToken: generateTunnelToken(), tunnelEnrolled: false };
      break;
    case "enroll":
      data = {
        tunnelToken: onboarding.tunnelToken ?? generateTunnelToken(),
        tunnelEnrolled: true,
        localPort: localPort ?? onboarding.localPort ?? 3000,
        reachMode: "localhost",
      };
      break;
    case "disconnect":
      data = { tunnelEnrolled: false };
      break;
  }

  const updated = await prisma.onboarding.update({ where: { id: onboarding.id }, data });
  await audit(prisma, ctx, `tunnel.${action}`, `localhost:${updated.localPort ?? 3000}`);
  return NextResponse.json({
    tunnelToken: updated.tunnelToken,
    tunnelEnrolled: updated.tunnelEnrolled,
    localPort: updated.localPort ?? 3000,
  });
}
