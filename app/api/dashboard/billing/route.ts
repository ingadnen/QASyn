import { NextResponse } from "next/server";
import { PLAN_CREDITS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { MOCK_LATENCY_MS, readJson, validationError } from "@/lib/http";
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

/** POST /api/dashboard/billing — change plan, or save a (simulated) payment method. */
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

  const digits = input.cardNumber.replace(/\s/g, "");
  // Only the brand and the last 4 digits are stored. The full number is discarded here.
  const paymentMethod = `${brandOf(digits)} •••• ${digits.slice(-4)}`;
  await prisma.organisation.update({ where: { id: ctx.org.id }, data: { paymentMethod } });
  await audit(prisma, ctx, "billing.payment_method", paymentMethod);
  return NextResponse.json({ paymentMethod });
}
