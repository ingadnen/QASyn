import type { PlatformPaymentConfig } from "@prisma/client";
import { prisma } from "./db";

/** Single-row identifier for the platform payment configuration. */
export const PAYMENT_CONFIG_ID = "platform";

export const DEFAULT_PAYMENT_CONFIG = {
  paypalEnabled: true,
  paypalRecipientEmail: "ingrebhiadnen@gmail.com",
  paypalClientId: "",
  paypalMeOrCheckoutUrl: "https://www.paypal.com/cgi-bin/webscr",
  stripeEnabled: true,
  stripeRecipientAccount: "ingrebhiadnen@gmail.com",
  stripePublishableKey: "",
  stripeSecretKey: "",
  stripeWebhookSecret: "",
  invoiceEnabled: true,
  invoiceBeneficiaryName: "QASyn Inc.",
  invoiceRecipientEmail: "ingrebhiadnen@gmail.com",
  invoiceBankDetails: "RBC Royal Bank · Interac e-Transfer: ingrebhiadnen@gmail.com",
  currency: "USD",
  mode: "live_or_verified",
} as const;

export type PaymentConfigPatch = Partial<Omit<PlatformPaymentConfig, "id" | "createdAt" | "updatedAt">>;

export interface PublicPaymentConfig {
  paypalRecipientEmail: string;
  stripeRecipientAccount: string;
  invoiceBeneficiaryName: string;
  invoiceRecipientEmail: string;
  invoiceBankDetails: string;
  currency: string;
  paypalEnabled: boolean;
  stripeEnabled: boolean;
  invoiceEnabled: boolean;
  hasLiveStripeKey: boolean;
  hasLivePaypalClient: boolean;
}

/** Returns the singleton config, creating it with the production defaults on first read. */
export async function getPaymentConfig(): Promise<PlatformPaymentConfig> {
  return prisma.platformPaymentConfig.upsert({
    where: { id: PAYMENT_CONFIG_ID },
    create: { id: PAYMENT_CONFIG_ID, ...DEFAULT_PAYMENT_CONFIG },
    update: {},
  });
}

/** Masks a secret for GET responses while keeping a recognisable prefix/suffix. */
export function maskPaymentSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, Math.min(7, value.length - 4))}••••${value.slice(-4)}`;
}

/** Safe projection returned by the checkout config API. */
export function toPublicPaymentConfig(config: PlatformPaymentConfig): PublicPaymentConfig {
  return {
    paypalRecipientEmail: config.paypalRecipientEmail,
    stripeRecipientAccount: config.stripeRecipientAccount,
    invoiceBeneficiaryName: config.invoiceBeneficiaryName,
    invoiceRecipientEmail: config.invoiceRecipientEmail,
    invoiceBankDetails: config.invoiceBankDetails,
    currency: config.currency,
    paypalEnabled: config.paypalEnabled,
    stripeEnabled: config.stripeEnabled,
    invoiceEnabled: config.invoiceEnabled,
    hasLiveStripeKey: Boolean(config.stripeSecretKey.trim()),
    hasLivePaypalClient: Boolean(config.paypalClientId.trim()),
  };
}

/** Super Admin projection: secrets are masked and can never leak through a GET. */
export function toSuperAdminPaymentConfig(config: PlatformPaymentConfig) {
  return {
    ...config,
    stripeSecretKey: maskPaymentSecret(config.stripeSecretKey),
    stripeWebhookSecret: maskPaymentSecret(config.stripeWebhookSecret),
  };
}

/**
 * Persists a payment configuration patch. Masked secret values returned by GET
 * are ignored so an unmodified form cannot overwrite the stored secret.
 */
export async function updatePaymentConfig(patch: PaymentConfigPatch): Promise<PlatformPaymentConfig> {
  const data: PaymentConfigPatch = { ...patch };
  for (const key of ["stripeSecretKey", "stripeWebhookSecret"] as const) {
    const value = data[key];
    if (typeof value === "string" && (value.includes("•") || value.includes("*"))) {
      delete data[key];
    }
  }
  return prisma.platformPaymentConfig.upsert({
    where: { id: PAYMENT_CONFIG_ID },
    create: { id: PAYMENT_CONFIG_ID, ...data },
    update: data,
  });
}

export type PaymentMethod = "stripe" | "paypal" | "invoice";

/** Exact payout destination for a checkout method. */
export function paymentRecipientFor(config: PlatformPaymentConfig, method: PaymentMethod): string {
  if (method === "paypal") return config.paypalRecipientEmail;
  if (method === "invoice") return config.invoiceRecipientEmail;
  return config.stripeRecipientAccount;
}
