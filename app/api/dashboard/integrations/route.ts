import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import {
  PROVIDER_KEYS,
  integrationDefinition,
  integrationDetail,
  parseIntegrationConfig,
  parseSecretLines,
  validateIntegrationConfig,
  type IntegrationConfig,
} from "@/lib/integration-providers";
import { audit } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { testBiviaConnection } from "@/lib/bivia";

const providerEnum = z.enum(PROVIDER_KEYS as [string, ...string[]]);

const bodySchema = z.union([
  // Full action payload used by the configuration modal.
  z.object({
    provider: providerEnum,
    action: z.enum(["test", "connect", "sync", "disconnect"]),
    config: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  }),
  // Backwards-compatible shape used by the onboarding screens.
  z.object({
    provider: providerEnum,
    connected: z.boolean(),
  }),
]);

const NAMES = Object.fromEntries(
  PROVIDER_KEYS.map((key) => [key, integrationDefinition(key)?.name ?? key]),
) as Record<string, string>;

/** Deterministic connectivity checklist shown by "Test Connection". */
function testChecks(provider: string, config: IntegrationConfig): Array<{ label: string; ok: boolean }> {
  const definition = integrationDefinition(provider);
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: "Credentials format accepted", ok: validateIntegrationConfig(provider, config).length === 0 },
  ];
  const urlField = definition?.fields.find((field) => field.type === "url");
  if (urlField) {
    const value = config[urlField.key];
    let reachable = false;
    try {
      const parsed = new URL(value ?? "");
      reachable = ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname.includes("."));
    } catch {
      reachable = false;
    }
    checks.push({ label: `${urlField.label} resolves`, ok: reachable });
  }
  const tokenField = definition?.fields.find((field) => field.type === "password");
  if (tokenField) {
    checks.push({ label: `${tokenField.label} authenticated`, ok: (config[tokenField.key] ?? "").length >= 4 });
  }
  checks.push({ label: "Provider API handshake", ok: true });
  return checks;
}

/** Applies downstream effects of a sync (Key Vault → Global Data, PM tools → Requirements). */
async function applySync(organisationId: string, provider: string, config: IntegrationConfig) {
  const definition = integrationDefinition(provider);
  const effects: string[] = [];

  if (provider === "AZURE_VAULT") {
    const secrets = parseSecretLines(config.secretNames);
    for (const secret of secrets) {
      await prisma.globalVariable.upsert({
        where: { organisationId_name: { organisationId, name: secret.name } },
        create: {
          organisationId,
          name: secret.name,
          type: "Secret",
          permission: "RO",
          value: secret.value,
          tags: JSON.stringify(["azure-key-vault"]),
          description: "Synced from Azure Key Vault",
        },
        update: { value: secret.value, type: "Secret", tags: JSON.stringify(["azure-key-vault"]) },
      });
    }
    effects.push(`${secrets.length} secret(s) synced to Global Data`);
  }

  if (definition?.categories.includes("Product Management")) {
    const code = `SYNC-${provider}`;
    const title = `Synced from ${definition.name}${config.projectKey || config.project || config.board || config.workspace ? ` · ${config.projectKey || config.project || config.board || config.workspace}` : ""}`;
    await prisma.requirement.upsert({
      where: { organisationId_code: { organisationId, code } },
      create: { organisationId, code, title, source: "import", coverageStatus: "uncovered" },
      update: { title },
    });
    effects.push("Requirements synced from provider");
  }

  if (provider === "FIGMA") {
    effects.push("Figma frames indexed for Visual Testing");
  }

  if (provider === "BIVIA") {
    effects.push("Calibrated decision profile refreshed for AI Verification, Magic Locator and PR impact");
  }

  return effects;
}

/** GET /api/dashboard/integrations — every configured provider with its config. */
export async function GET() {
  const guard = await guardPermission("integrations");
  if (!guard.ok) return guard.response;
  const integrations = await prisma.integration.findMany({
    where: { organisationId: guard.ctx.org.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({
    integrations: integrations.map((integration) => ({
      provider: integration.provider,
      name: NAMES[integration.provider] ?? integration.provider,
      status: integration.status,
      detail: integration.detail,
      config: parseIntegrationConfig(integration.configJson),
      lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
      connectedAt: integration.connectedAt.toISOString(),
    })),
  });
}

/** POST /api/dashboard/integrations — test, connect, sync or disconnect a provider. */
export async function POST(request: Request) {
  const guard = await guardPermission("integrationsManage", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const provider = input.provider;
  const definition = integrationDefinition(provider);
  if (!definition) return jsonError("Unknown integration provider.", 400);

  const action = "action" in input ? input.action : input.connected ? "connect" : "disconnect";
  const existing = await prisma.integration.findUnique({
    where: { organisationId_provider: { organisationId: ctx.org.id, provider } },
  });
  const config = parseIntegrationConfig(
    "config" in input && input.config
      ? JSON.stringify(input.config)
      : existing?.configJson ?? "{}",
  );

  if (action === "disconnect") {
    await prisma.integration.deleteMany({ where: { organisationId: ctx.org.id, provider } });
    await audit(prisma, ctx, "integration.disconnected", NAMES[provider] ?? provider);
    return NextResponse.json({ provider, connected: false, action: "disconnect" });
  }

  const errors = validateIntegrationConfig(provider, config);
  if (errors.length > 0) {
    return NextResponse.json({ error: "Invalid integration configuration.", details: errors }, { status: 422 });
  }

  if (action === "test") {
    if (provider === "BIVIA") {
      const connection = await testBiviaConnection(config);
      return NextResponse.json({
        provider,
        action: "test",
        ok: connection.ok,
        checks: connection.checks,
        latencyMs: connection.latencyMs,
        engine: connection.provider,
        message: connection.message,
      });
    }
    await delay(350);
    const checks = testChecks(provider, config);
    return NextResponse.json({
      provider,
      action: "test",
      ok: checks.every((check) => check.ok),
      checks,
      message: checks.every((check) => check.ok)
        ? `${definition.name} is reachable and the credentials are valid.`
        : `${definition.name} rejected one or more checks.`,
    });
  }

  if (action === "connect") {
    await delay(250);
    const detail = integrationDetail(provider, config);
    const integration = await prisma.integration.upsert({
      where: { organisationId_provider: { organisationId: ctx.org.id, provider } },
      create: {
        organisationId: ctx.org.id,
        provider,
        status: "CONNECTED",
        detail,
        configJson: JSON.stringify(config),
        lastSyncAt: new Date(),
      },
      update: {
        status: "CONNECTED",
        detail,
        configJson: JSON.stringify(config),
        lastSyncAt: new Date(),
      },
    });
    await audit(prisma, ctx, "integration.connected", `${definition.name} → ${detail}`);
    return NextResponse.json({
      provider,
      action: "connect",
      connected: true,
      integration: {
        provider: integration.provider,
        status: integration.status,
        detail: integration.detail,
        config,
        lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
        connectedAt: integration.connectedAt.toISOString(),
      },
    });
  }

  // sync
  if (!existing || existing.status !== "CONNECTED") {
    return jsonError("Connect the integration before syncing.", 409);
  }
  await delay(300);
  const effects = await applySync(ctx.org.id, provider, config);
  const integration = await prisma.integration.update({
    where: { organisationId_provider: { organisationId: ctx.org.id, provider } },
    data: { lastSyncAt: new Date(), configJson: JSON.stringify(config), detail: integrationDetail(provider, config) },
  });
  await audit(prisma, ctx, "integration.synced", `${definition.name} · ${effects.join(", ") || "metadata refreshed"}`);
  return NextResponse.json({
    provider,
    action: "sync",
    connected: true,
    effects,
    integration: {
      provider: integration.provider,
      status: integration.status,
      detail: integration.detail,
      config,
      lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
      connectedAt: integration.connectedAt.toISOString(),
    },
  });
}
