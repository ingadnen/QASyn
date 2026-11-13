import { NextResponse } from "next/server";
import { PLAN_CREDITS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { getPaymentConfig, paymentRecipientFor, type PaymentMethod } from "@/lib/payment-config";
import { audit } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { billingSchema } from "@/lib/validation";

interface PaymentInput {
  method?: PaymentMethod;
  cardholder?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvc?: string;
  paypalEmail?: string;
  paypalTransactionId?: string;
  invoiceReference?: string;
}

function brandOf(digits: string) {
  if (digits.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  return "Card";
}

function luhnValid(digits: string): boolean {
  let total = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    total += value;
    double = !double;
  }
  return total % 10 === 0;
}

function expiryValid(expiry: string): boolean {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  // Valid through the last day of the expiry month.
  return new Date(year, month, 1).getTime() > Date.now();
}

function validateCard(input: PaymentInput): string | null {
  const digits = String(input.cardNumber ?? "").replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return "Enter a valid card number.";
  if (!luhnValid(digits)) return "The card number failed the Luhn check.";
  if (!input.cardExpiry) return "Card expiry (MM/YY) is required.";
  if (!expiryValid(input.cardExpiry)) return "The card expiry is invalid or in the past.";
  if (!input.cardCvc || !/^\d{3,4}$/.test(input.cardCvc)) return "Enter a 3 or 4 digit CVC.";
  return null;
}

function paymentLabel(input: PaymentInput): string {
  if (input.method === "paypal") return `PayPal · ${input.paypalEmail || "verified payer"}`;
  if (input.method === "invoice") return `Invoice / PO · ${input.invoiceReference || "NET-30"}`;
  const digits = String(input.cardNumber ?? "").replace(/\s/g, "");
  if (digits.length >= 12) return `${brandOf(digits)} ···· ${digits.slice(-4)}`;
  return "Payment method saved";
}

async function createStripePaymentIntent(input: {
  secretKey: string;
  amountCents: number;
  currency: string;
  description: string;
  recipient: string;
  payerEmail?: string;
}) {
  const body = new URLSearchParams({
    amount: String(input.amountCents),
    currency: input.currency.toLowerCase(),
    description: input.description.slice(0, 200),
    "payment_method_types[]": "card",
    "metadata[recipient]": input.recipient,
  });
  if (input.payerEmail) body.set("receipt_email", input.payerEmail);
  const response = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    client_secret?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe rejected the PaymentIntent (${response.status}).`);
  }
  return {
    id: String(payload.id ?? ""),
    status: String(payload.status ?? "requires_payment_method"),
    clientSecret: String(payload.client_secret ?? ""),
  };
}

/** POST /api/dashboard/billing — plan, payment, credit top-up, checkout and user quota allocation. */
export async function POST(request: Request) {
  const guard = await guardPermission("billingManage", { write: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const parsed = billingSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  await delay(MOCK_LATENCY_MS);

  if (input.action === "plan") {
    await prisma.organisation.update({ where: { id: ctx.org.id }, data: { plan: input.plan, trialCredits: PLAN_CREDITS[input.plan] } });
    await audit(prisma, ctx, "billing.plan_changed", `${ctx.org.plan} → ${input.plan}`);
    return NextResponse.json({ plan: input.plan });
  }

  if (input.action === "allocation") {
    const member = await prisma.user.findFirst({ where: { id: input.userId, organisationId: ctx.org.id } });
    if (!member) return jsonError("Team member not found.", 404);
    const updated = await prisma.user.update({ where: { id: member.id }, data: { creditQuota: input.quota } });
    await audit(prisma, ctx, "billing.quota_allocated", `${member.email} · ${input.quota} tokens`);
    return NextResponse.json({ member: { id: updated.id, email: updated.email, creditQuota: updated.creditQuota, creditsConsumed: updated.creditsConsumed } });
  }

  const config = await getPaymentConfig();

  if (input.action === "credits" || input.action === "checkout") {
    const method: PaymentMethod = input.method ?? "stripe";
    const credits = input.action === "credits" ? input.credits : Math.max(PLAN_CREDITS[input.plan], 0) + input.credits;
    const plan = input.action === "checkout" ? input.plan : ctx.org.plan;

    if (
      (method === "paypal" && !config.paypalEnabled) ||
      (method === "stripe" && !config.stripeEnabled) ||
      (method === "invoice" && !config.invoiceEnabled)
    ) {
      return jsonError("This payment method is currently disabled by the platform administrator.", 400);
    }

    if (method === "stripe" && !config.stripeSecretKey) {
      const cardError = validateCard(input);
      if (cardError) return jsonError(cardError, 400);
    }

    const recipient = paymentRecipientFor(config, method);
    let stripeIntent: { id: string; status: string; clientSecret: string } | null = null;
    if (method === "stripe" && config.stripeSecretKey) {
      const planPriceCents = plan === "starter" ? 9_900 : plan === "pro" ? 29_900 : 0;
      const creditsCents = Math.round((input.action === "credits" ? input.credits : input.credits) * 0.025 * 100);
      const amountCents = Math.max(50, planPriceCents || creditsCents);
      try {
        stripeIntent = await createStripePaymentIntent({
          secretKey: config.stripeSecretKey,
          amountCents,
          currency: config.currency,
          description: input.action === "checkout" ? `QASyn ${plan} plan` : `QASyn ${input.credits} credits`,
          recipient,
          payerEmail: input.paypalEmail,
        });
      } catch (caught) {
        return jsonError(caught instanceof Error ? caught.message : "Stripe checkout failed.", 502);
      }
    }

    const methodLabel = paymentLabel(input);
    const paymentMethod = stripeIntent ? `${methodLabel} · Stripe PaymentIntent ${stripeIntent.id}` : methodLabel;
    const transactionRef = stripeIntent?.id || input.paypalTransactionId || input.invoiceReference || "";
    const note = `${paymentMethod} · recipient ${recipient}${transactionRef ? ` · ref ${transactionRef}` : ""}`;
    const updated = await prisma.$transaction(async (tx) => {
      const org = await tx.organisation.update({
        where: { id: ctx.org.id },
        data: {
          ...(input.action === "checkout" ? { plan, trialCredits: { increment: credits } } : { trialCredits: { increment: input.credits } }),
          paymentMethod,
        },
        select: { id: true, plan: true, trialCredits: true, creditsUsed: true, paymentMethod: true },
      });
      await tx.creditEntry.create({
        data: {
          organisationId: ctx.org.id,
          action: input.action === "checkout" ? `Plan checkout · ${plan}` : "Credit top-up",
          credits,
          kind: "grant",
          note,
        },
      });
      return org;
    });
    await audit(prisma, ctx, input.action === "checkout" ? "billing.checkout" : "billing.credits_purchased", `${credits} credits · ${note}`);
    return NextResponse.json({
      organisation: updated,
      creditsAdded: credits,
      paymentMethod,
      recipient,
      ...(stripeIntent ? { stripePaymentIntentId: stripeIntent.id, stripeStatus: stripeIntent.status, stripeClientSecret: stripeIntent.clientSecret } : {}),
    });
  }

  // Legacy card-only payment action used by the compact payment modal.
  const digits = input.cardNumber.replace(/\s/g, "");
  const paymentMethod = `${brandOf(digits)} ···· ${digits.slice(-4)}`;
  const recipient = config.stripeRecipientAccount;
  await prisma.organisation.update({ where: { id: ctx.org.id }, data: { paymentMethod } });
  await audit(prisma, ctx, "billing.payment_method", `${paymentMethod} · recipient ${recipient}`);
  return NextResponse.json({ paymentMethod, recipient });
}
