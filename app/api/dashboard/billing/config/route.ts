import { NextResponse } from "next/server";
import { getPaymentConfig, toPublicPaymentConfig } from "@/lib/payment-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/billing/config
 * Safe checkout configuration: payout recipients only, never secret keys.
 * Consumed by the Billing and Onboarding Step 7 checkout modals.
 */
export async function GET() {
  const config = await getPaymentConfig();
  return NextResponse.json(toPublicPaymentConfig(config), {
    headers: { "Cache-Control": "no-store" },
  });
}
