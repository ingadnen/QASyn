import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getPaymentConfig, toPublicPaymentConfig } from "@/lib/payment-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/billing/config
 * Safe checkout configuration: payout recipients only, never secret keys.
 * Consumed by the Billing and Onboarding Step 7 checkout modals.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to view checkout configuration.", 401);
  const config = await getPaymentConfig();
  return NextResponse.json(toPublicPaymentConfig(config), {
    headers: { "Cache-Control": "no-store" },
  });
}
