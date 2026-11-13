import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Integration } from "@prisma/client";
import { decryptSecret, encryptSecret } from "./crypto";
import { prisma } from "./db";

/**
 * Platform-wide outbound email configuration.
 *
 * Stored as an `Integration` row with provider `PLATFORM_EMAIL` on the primary
 * QASyn HQ organisation. Secrets are AES-256-GCM encrypted at rest and are only
 * ever exposed as masked booleans through the Super Admin API.
 */

export const PLATFORM_EMAIL_PROVIDER = "PLATFORM_EMAIL";
export const PLATFORM_EMAIL_ORG_SLUG = "qasyn-hq";
export const DEFAULT_FROM_ADDRESS = "QASyn <info@qasyn.io>";
export const DEFAULT_CONTACT_RECIPIENT_EMAIL = process.env.CONTACT_RECIPIENT_EMAIL || "adnen.rebhi@qasyn.com";

export type EmailProvider = "smtp" | "resend";

interface StoredEmailConfig {
  enabled?: boolean;
  provider?: EmailProvider;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassEncrypted?: string;
  fromAddress?: string;
  contactRecipientEmail?: string;
  resendApiKeyEncrypted?: string;
  updatedBy?: string | null;
}

export interface PlatformEmailConfigView {
  enabled: boolean;
  provider: EmailProvider;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassConfigured: boolean;
  smtpPassMasked: string;
  fromAddress: string;
  contactRecipientEmail: string;
  resendApiKeyConfigured: boolean;
  resendApiKeyMasked: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PlatformEmailRuntimeSecrets {
  enabled: boolean;
  provider: EmailProvider;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  fromAddress: string;
  contactRecipientEmail: string;
  resendApiKey: string;
}

export type PlatformEmailConfigPatch = Partial<{
  enabled: boolean;
  provider: EmailProvider;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  contactRecipientEmail: string;
  resendApiKey: string;
}>;

export interface MailDeliveryLogEntry {
  at: string;
  to: string;
  subject: string;
  provider: string;
  status: string;
  error?: string | null;
}

function parseStoredConfig(value: string | null | undefined): StoredEmailConfig {
  try {
    return JSON.parse(value || "{}") as StoredEmailConfig;
  } catch {
    return {};
  }
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function maskEmailSecret(value: string | null | undefined): string {
  return value ? "••••••••" : "";
}

async function primaryOrganisationId(): Promise<string | null> {
  const primary = await prisma.organisation.findUnique({
    where: { slug: PLATFORM_EMAIL_ORG_SLUG },
    select: { id: true },
  });
  if (primary) return primary.id;
  const first = await prisma.organisation.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

async function getPlatformEmailRow(): Promise<{ row: Integration; config: StoredEmailConfig } | null> {
  const organisationId = await primaryOrganisationId();
  if (!organisationId) return null;
  const row = await prisma.integration.findUnique({
    where: { organisationId_provider: { organisationId, provider: PLATFORM_EMAIL_PROVIDER } },
  });
  return row ? { row, config: parseStoredConfig(row.configJson) } : null;
}

function toPlatformEmailConfig(row: Integration): PlatformEmailConfigView {
  const config = parseStoredConfig(row.configJson);
  const envPass = clean(process.env.SMTP_PASS);
  const envResendKey = clean(process.env.RESEND_API_KEY);
  const smtpPassConfigured = Boolean(clean(config.smtpPassEncrypted) || envPass);
  const resendApiKeyConfigured = Boolean(clean(config.resendApiKeyEncrypted) || envResendKey);
  return {
    enabled: config.enabled !== false,
    provider: config.provider === "resend" ? "resend" : "smtp",
    smtpHost: clean(config.smtpHost) || clean(process.env.SMTP_HOST),
    smtpPort: numberOr(config.smtpPort, Number(process.env.SMTP_PORT ?? 465)),
    smtpUser: clean(config.smtpUser) || clean(process.env.SMTP_USER),
    smtpPassConfigured,
    smtpPassMasked: maskEmailSecret(smtpPassConfigured ? "configured" : ""),
    fromAddress: clean(config.fromAddress) || clean(process.env.SMTP_FROM) || DEFAULT_FROM_ADDRESS,
    contactRecipientEmail:
      clean(config.contactRecipientEmail) || clean(process.env.CONTACT_RECIPIENT_EMAIL) || DEFAULT_CONTACT_RECIPIENT_EMAIL,
    resendApiKeyConfigured,
    resendApiKeyMasked: maskEmailSecret(resendApiKeyConfigured ? "configured" : ""),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: clean(config.updatedBy) || null,
  };
}

/** Masked configuration returned by the Super Admin API. */
export async function getPlatformEmailConfig(): Promise<PlatformEmailConfigView> {
  const stored = await getPlatformEmailRow();
  if (stored) return toPlatformEmailConfig(stored.row);

  const envPass = clean(process.env.SMTP_PASS);
  const envResendKey = clean(process.env.RESEND_API_KEY);
  return {
    enabled: true,
    provider: "smtp",
    smtpHost: clean(process.env.SMTP_HOST),
    smtpPort: numberOr(process.env.SMTP_PORT, 465),
    smtpUser: clean(process.env.SMTP_USER),
    smtpPassConfigured: Boolean(envPass),
    smtpPassMasked: maskEmailSecret(envPass ? "configured" : ""),
    fromAddress: clean(process.env.SMTP_FROM) || DEFAULT_FROM_ADDRESS,
    contactRecipientEmail: clean(process.env.CONTACT_RECIPIENT_EMAIL) || DEFAULT_CONTACT_RECIPIENT_EMAIL,
    resendApiKeyConfigured: Boolean(envResendKey),
    resendApiKeyMasked: maskEmailSecret(envResendKey ? "configured" : ""),
    updatedAt: null,
    updatedBy: null,
  };
}

/** Server-only decrypted configuration, falling back to environment variables. */
export async function getPlatformEmailRuntimeSecrets(): Promise<PlatformEmailRuntimeSecrets> {
  const stored = await getPlatformEmailRow();
  const config = stored?.config ?? {};
  const smtpPass = decryptSecret(clean(config.smtpPassEncrypted)) || clean(process.env.SMTP_PASS);
  const resendApiKey = decryptSecret(clean(config.resendApiKeyEncrypted)) || clean(process.env.RESEND_API_KEY);
  const smtpPort = numberOr(config.smtpPort, Number(process.env.SMTP_PORT ?? 465));
  return {
    enabled: config.enabled !== false,
    provider: config.provider === "resend" ? "resend" : "smtp",
    smtpHost: clean(config.smtpHost) || clean(process.env.SMTP_HOST),
    smtpPort,
    smtpUser: clean(config.smtpUser) || clean(process.env.SMTP_USER),
    smtpPass,
    smtpSecure: smtpPort === 465 || clean(process.env.SMTP_SECURE).toLowerCase() === "true",
    fromAddress: clean(config.fromAddress) || clean(process.env.SMTP_FROM) || DEFAULT_FROM_ADDRESS,
    contactRecipientEmail:
      clean(config.contactRecipientEmail) || clean(process.env.CONTACT_RECIPIENT_EMAIL) || DEFAULT_CONTACT_RECIPIENT_EMAIL,
    resendApiKey,
  };
}

/**
 * Persists a configuration patch. Blank or masked secret fields preserve the
 * currently stored encrypted secret.
 */
export async function updatePlatformEmailConfig(
  patch: PlatformEmailConfigPatch,
  updatedBy: string,
): Promise<PlatformEmailConfigView> {
  const organisationId = await primaryOrganisationId();
  if (!organisationId) throw new Error("No organisation is available for the platform email configuration.");

  const existing = await prisma.integration.findUnique({
    where: { organisationId_provider: { organisationId, provider: PLATFORM_EMAIL_PROVIDER } },
  });
  const next: StoredEmailConfig = { ...parseStoredConfig(existing?.configJson), updatedBy };

  if (patch.enabled !== undefined) next.enabled = patch.enabled;
  if (patch.provider !== undefined) next.provider = patch.provider;
  if (patch.smtpHost !== undefined) next.smtpHost = patch.smtpHost.trim();
  if (patch.smtpPort !== undefined) next.smtpPort = patch.smtpPort;
  if (patch.smtpUser !== undefined) next.smtpUser = patch.smtpUser.trim();
  if (patch.fromAddress !== undefined) next.fromAddress = patch.fromAddress.trim();
  if (patch.contactRecipientEmail !== undefined) next.contactRecipientEmail = patch.contactRecipientEmail.trim();

  const smtpPass = patch.smtpPass?.trim();
  if (smtpPass && !smtpPass.includes("•")) next.smtpPassEncrypted = encryptSecret(smtpPass);
  const resendApiKey = patch.resendApiKey?.trim();
  if (resendApiKey && !resendApiKey.includes("•")) next.resendApiKeyEncrypted = encryptSecret(resendApiKey);

  const configJson = JSON.stringify(next);
  const status = next.enabled === false ? "DISABLED" : "CONNECTED";
  const detail = next.provider === "resend" ? "Resend API" : next.smtpHost ? `SMTP · ${next.smtpHost}` : "SMTP not configured";

  const row = await prisma.integration.upsert({
    where: { organisationId_provider: { organisationId, provider: PLATFORM_EMAIL_PROVIDER } },
    create: { organisationId, provider: PLATFORM_EMAIL_PROVIDER, status, detail, configJson },
    update: { status, detail, configJson },
  });
  return toPlatformEmailConfig(row);
}

/** Appends one delivery attempt to the persistent Super Admin delivery log. */
export async function appendMailDeliveryLog(entry: MailDeliveryLogEntry): Promise<void> {
  try {
    const logDir = path.join(process.cwd(), ".qasyn-data");
    await mkdir(logDir, { recursive: true });
    await appendFile(path.join(logDir, "mail-delivery.log"), `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    /* best-effort observability */
  }
}

/** Last N delivery attempts, newest first. */
export async function readMailDeliveryLog(limit = 10): Promise<MailDeliveryLogEntry[]> {
  try {
    const file = path.join(process.cwd(), ".qasyn-data", "mail-delivery.log");
    const text = await readFile(file, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line) as MailDeliveryLogEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is MailDeliveryLogEntry => Boolean(entry))
      .reverse();
  } catch {
    return [];
  }
}
