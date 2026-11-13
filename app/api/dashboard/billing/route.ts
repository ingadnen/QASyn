import { NextResponse } from "next/server";
import { PLAN_CREDITS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { jsonError, MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
import { audit } from "@/lib/tenant";
import { guardPermission } from "@/lib/rbac-server";
import { delay } from "@/lib/utils";
import { billingSchema } from "@/lib/validation";

function brandOf(digits: string) {
  if (digits.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  return "Card";
}

function paymentLabel(input: { method?: "stripe" | "paypal" | "invoice"; cardholder?: string; cardNumber?: string; paypalEmail?: string; invoiceReference?: string }): string {
  if (input.method === "paypal") return `PayPal · ${input.paypalEmail || "billing@qasyn.com"}`;
  if (input.method === "invoice") return `Invoice / PO · ${input.invoiceReference || "NET-30"}`;
  const digits = String(input.cardNumber ?? "").replace(/\s/g, "");
  if (digits.length >= 12) return `${brandOf(digits)} ···· ${digits.slice(-4)}`;
  return "Payment method saved";
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

  if (input.action === "credits" || input.action === "checkout") {
    const credits = input.action === "credits" ? input.credits : Math.max(PLAN_CREDITS[input.plan], 0) + input.credits;
    const method = paymentLabel(input);
    const plan = input.action === "checkout" ? input.plan : ctx.org.plan;
    const updated = await prisma.$transaction(async (tx) => {
      const org = await tx.organisation.update({
        where: { id: ctx.org.id },
        data: {
          ...(input.action === "checkout" ? { plan, trialCredits: credits } : { trialCredits: { increment: input.credits } }),
          paymentMethod: method,
        },
        select: { id: true, plan: true, trialCredits: true, creditsUsed: true, paymentMethod: true },
      });
      await tx.creditEntry.create({
        data: {
          organisationId: ctx.org.id,
          action: input.action === "checkout" ? `Plan checkout · ${plan}` : "Credit top-up",
          credits,
          kind: "grant",
          note: `${method}${input.action === "checkout" ? ` · ${plan}` : ""}`,
        },
      });
      return org;
    });
    await audit(prisma, ctx, input.action === "checkout" ? "billing.checkout" : "billing.credits_purchased", `${credits} credits · ${method}`);
    return NextResponse.json({ organisation: updated, creditsAdded: credits, paymentMethod: method });
  }

  // Legacy card-only payment action.
  const digits = input.cardNumber.replace(/\s/g, "");
  const paymentMethod = `${brandOf(digits)} ···· ${digits.slice(-4)}`;
  await prisma.organisation.update({ where: { id: ctx.org.id }, data: { paymentMethod } });
  await audit(prisma, ctx, "billing.payment_method", paymentMethod);
  return NextResponse.json({ paymentMethod });
}
