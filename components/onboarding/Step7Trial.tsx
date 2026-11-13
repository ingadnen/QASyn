"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, cqaInput, cqaLabel } from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { FOCUS_OPTIONS, PROVIDER_META, TRIAL_CREDITS, TRIAL_DAYS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { toast } from "@/lib/toast";
import { cn, hostOf } from "@/lib/utils";
import { useSaveStep } from "./hooks";

interface PaymentConfigView {
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

const DEFAULT_PAYMENT_CONFIG: PaymentConfigView = {
  paypalRecipientEmail: "ingrebhiadnen@gmail.com",
  stripeRecipientAccount: "ingrebhiadnen@gmail.com",
  invoiceBeneficiaryName: "QASyn Inc.",
  invoiceRecipientEmail: "ingrebhiadnen@gmail.com",
  invoiceBankDetails: "RBC Royal Bank · Interac e-Transfer: ingrebhiadnen@gmail.com",
  currency: "USD",
  paypalEnabled: true,
  stripeEnabled: true,
  invoiceEnabled: true,
  hasLiveStripeKey: false,
  hasLivePaypalClient: false,
};

function luhnValid(digits: string) {
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

function expiryValid(expiry: string) {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  return month >= 1 && month <= 12 && new Date(year, month, 1).getTime() > Date.now();
}

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const PLANS = [
  { key: "trial", name: "12-Week Free Pilot", price: "$0", detail: "3,000 AI credits · no card required" },
  { key: "starter", name: "Starter", price: "$99/mo", detail: "20,000 credits · 5 seats" },
  { key: "pro", name: "Team / Pro", price: "$299/mo", detail: "120,000 credits · unlimited seats · most popular" },
  { key: "enterprise", name: "Enterprise", price: "Custom", detail: "Custom SLA · SSO · invoice / PO" },
];

export function Step7Trial() {
  const { state } = useOnboarding();
  const { save, pending, error } = useSaveStep();
  const [review, setReview] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [planKey, setPlanKey] = useState("trial");
  const [method, setMethod] = useState<"stripe" | "paypal" | "invoice">("stripe");
  const [cardholder, setCardholder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalTransactionId, setPaypalTransactionId] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("FREE-PILOT");
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [config, setConfig] = useState<PaymentConfigView>(DEFAULT_PAYMENT_CONFIG);

  useEffect(() => {
    apiFetch<PaymentConfigView>("/api/dashboard/billing/config", { method: "GET" })
      .then((payload) => setConfig(payload))
      .catch(() => undefined);
  }, []);

  const selectedPlan = PLANS.find((plan) => plan.key === planKey) ?? PLANS[0];
  const needsPayment = planKey !== "trial";
  const planAmount = planKey === "starter" ? 99 : planKey === "pro" ? 299 : 0;
  const paypalLink = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(config.paypalRecipientEmail)}&item_name=${encodeURIComponent(`${selectedPlan.name} plan`)}&amount=${planAmount.toFixed(2)}&currency_code=${config.currency}`;
  const validPayment =
    !needsPayment ||
    (method === "stripe" &&
      cardholder.trim().length >= 2 &&
      cardNumber.replace(/\D/g, "").length >= 13 &&
      cardNumber.replace(/\D/g, "").length <= 19 &&
      luhnValid(cardNumber.replace(/\D/g, "")) &&
      expiryValid(cardExpiry) &&
      /^\d{3,4}$/.test(cardCvc)) ||
    (method === "paypal" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paypalEmail)) ||
    (method === "invoice" && invoiceReference.trim().length >= 2);

  async function checkout() {
    setCheckoutPending(true);
    setCheckoutError(null);
    try {
      await apiFetch("/api/dashboard/billing", {
        method: "POST",
        json: { action: "checkout", plan: planKey, method, cardholder, cardNumber, cardExpiry, cardCvc, paypalEmail, paypalTransactionId, invoiceReference: invoiceReference || "FREE-PILOT", credits: 0 },
      });
      toast(`${selectedPlan.name} activated and credits added to the workspace.`, "success");
      setCheckoutOpen(false);
      await save({ step: 7 });
    } catch (caught) {
      setCheckoutError(errorMessage(caught));
    } finally {
      setCheckoutPending(false);
    }
  }

  const end = state.trialEndsAt ? new Date(state.trialEndsAt) : new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  const start = new Date(end.getTime() - TRIAL_DAYS * 86_400_000);
  const names = (list: string[]) => (list.length ? list.join(", ") : "Not connected");

  const summary: Array<{ label: string; value: string; step: number }> = [
    {
      label: "Environment",
      value: state.reachMode === "localhost" ? `localhost:${state.localPort} (tunnel)` : hostOf(state.environmentUrl) ?? "Not set",
      step: 1,
    },
    {
      label: "Sign-in",
      value:
        state.appLoginType === "credentials"
          ? `Credentials · ${state.appLoginUsername}`
          : state.appLoginType === "signup_test_account"
            ? "Test account sign-up"
            : "No login needed",
      step: 1,
    },
    { label: "Context", value: state.painPoints.join(", ") || "Skipped", step: 2 },
    {
      label: "Code",
      value: names(state.integrations.filter((i) => i.provider === "GITHUB" || i.provider === "GITLAB").map((i) => PROVIDER_META[i.provider].name)),
      step: 3,
    },
    {
      label: "Tools",
      value: names(state.integrations.filter((i) => ["JIRA", "LINEAR", "SLACK"].includes(i.provider)).map((i) => PROVIDER_META[i.provider].name)),
      step: 4,
    },
    { label: "Focus", value: FOCUS_OPTIONS.find((f) => f.key === state.focusPriority)?.label ?? "Skipped", step: 5 },
    { label: "Team", value: state.invitedEmails.length ? `${state.invitedEmails.length} invited` : "Just you", step: 6 },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          ✓ Setup complete
        </p>
        <p className="mt-6 text-[11px] font-semibold tracking-[0.16em] text-brand-600">STEP 7 OF 7 · TRIAL</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Your workspace is ready</h1>
        <p className="mt-2 text-sm text-slate-500">QASyn keeps crawling in the background. Your first test cases appear on the dashboard.</p>
        <button
          type="button"
          onClick={() => setReview((v) => !v)}
          aria-expanded={review}
          className="mt-3 text-sm font-medium text-brand-600 hover:underline"
        >
          Review setup {review ? "▴" : "▾"}
        </button>
        {review && (
          <dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {summary.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2">
                <dt className="w-24 shrink-0 text-slate-500">{row.label}</dt>
                <dd className="min-w-0 flex-1 truncate text-slate-800">{row.value}</dd>
                <Link href={`/onboarding/${row.step}`} className="text-xs font-medium text-brand-600 hover:underline">
                  Edit
                </Link>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-brand-50 to-white p-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">{TRIAL_DAYS}-day Free trial</p>
            <p className="mt-0.5 text-xs text-slate-500">{TRIAL_CREDITS.toLocaleString("en-US")} one-time trial credits included</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-900">$0</p>
            <p className="text-xs text-slate-500">today</p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="relative flex items-center justify-between text-xs">
            <div className="absolute inset-x-3 top-1.5 h-0.5 bg-gradient-to-r from-brand-500 to-slate-200" aria-hidden="true" />
            <div className="relative">
              <span className="block size-3 rounded-full bg-brand-600 ring-4 ring-brand-100" />
              <p className="mt-2 font-semibold text-slate-800">Start today</p>
              <p className="text-slate-500">{fmt(start)}</p>
            </div>
            <div className="relative text-right">
              <span className="ml-auto block size-3 rounded-full bg-slate-300 ring-4 ring-slate-100" />
              <p className="mt-2 font-semibold text-slate-800">Trial ends</p>
              <p className="text-slate-500">{fmt(end)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2">
          <div className="bg-white p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">DURING THE TRIAL</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>✓ Crawls, test generation and runs</li>
              <li>✓ PR impact analysis and bug reproduction</li>
              <li>✓ {TRIAL_CREDITS.toLocaleString("en-US")} credits, unlimited seats</li>
            </ul>
          </div>
          <div className="bg-white p-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">AFTER IT ENDS</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>• Pick a plan, or stay on Free</li>
              <li>• Your tests and history are kept</li>
              <li>• No charge without a payment method</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <button key={plan.key} type="button" onClick={() => { setPlanKey(plan.key); setCheckoutOpen(true); }} className={cn("rounded-xl border p-4 text-left transition hover:border-brand-400", plan.key === "pro" ? "border-brand-500 bg-brand-50/50" : "border-slate-200 bg-white")}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
              {plan.key === "pro" && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[9.5px] font-semibold text-white">Most popular</span>}
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{plan.price}</p>
            <p className="mt-1 text-[11.5px] leading-4 text-slate-500">{plan.detail}</p>
            <span className="mt-3 inline-block text-[11.5px] font-semibold text-brand-600">Choose plan →</span>
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" onClick={() => save({ step: 7 })} loading={pending === "continue"} loadingText="Opening dashboard…" disabled={pending !== null}>
          Go to dashboard →
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className={cn("flex-1")}
          onClick={() => { setPlanKey("trial"); setCheckoutOpen(true); }}
          loading={pending === "skip"}
          disabled={pending !== null}
        >
          Add payment method
        </Button>
      </div>

      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Plan & payment checkout"
        footer={
          <>
            <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700" onClick={() => setCheckoutOpen(false)}>Cancel</button>
            <button type="button" data-testid="onboarding-checkout-submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={checkoutPending || !validPayment} onClick={() => void checkout()}>
              {checkoutPending ? "Processing…" : `Activate ${selectedPlan.name}`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {PLANS.map((plan) => <button key={plan.key} type="button" onClick={() => setPlanKey(plan.key)} className={cn("rounded-lg border px-3 py-2 text-left text-[12px] font-semibold", planKey === plan.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-700")}>{plan.name} · {plan.price}</button>)}
          </div>
          <label className="block">
            <span className={cqaLabel}>Payment method</span>
            <select className={cqaInput} value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
              <option value="stripe">Credit / debit card · Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="invoice">Enterprise invoice / Interac / PO</option>
            </select>
          </label>
          {method === "stripe" && needsPayment && (
            <>
              <div data-testid="payment-recipient-stripe" className="rounded-lg border border-[#d1fadf] bg-[#ecfdf3] px-3 py-2 text-[12px] text-[#067647]">
                <strong>Merchant Account:</strong> {config.stripeRecipientAccount} · Stripe Verified
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className={cqaLabel}>Cardholder</span><input className={cqaInput} value={cardholder} onChange={(e) => setCardholder(e.target.value)} placeholder="Jane Cooper" /></label>
                <label className="block"><span className={cqaLabel}>Card number</span><input className={cqaInput} inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" /></label>
                <label className="block"><span className={cqaLabel}>Expiry (MM/YY)</span><input className={cqaInput} inputMode="numeric" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="12/28" /></label>
                <label className="block"><span className={cqaLabel}>CVC</span><input className={cqaInput} inputMode="numeric" value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" /></label>
              </div>
              <p className="text-[11px] text-[#6b7280]">{config.hasLiveStripeKey ? "Live Stripe key detected — a PaymentIntent is created for this plan." : "Verified checkout: Luhn, expiry and CVC are validated before activation."}</p>
            </>
          )}
          {method === "paypal" && needsPayment && (
            <>
              <div data-testid="payment-recipient-paypal" className="rounded-lg border border-[#b2ddff] bg-[#eff8ff] px-3 py-2 text-[12px] text-[#175cd3]">
                <strong>PayPal Merchant Recipient:</strong> {config.paypalRecipientEmail}
              </div>
              <a href={paypalLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#175cd3] hover:underline">
                Pay via PayPal ({config.paypalRecipientEmail}) ↗
              </a>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className={cqaLabel}>Payer PayPal e-mail</span><input className={cqaInput} value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="billing@company.com" /></label>
                <label className="block"><span className={cqaLabel}>Transaction confirmation (optional)</span><input className={cqaInput} value={paypalTransactionId} onChange={(e) => setPaypalTransactionId(e.target.value)} placeholder="PayPal transaction ID" /></label>
              </div>
              <p className="text-[11px] text-[#6b7280]">Amount {planAmount.toFixed(2)} {config.currency} · {selectedPlan.name}</p>
            </>
          )}
          {method === "invoice" && needsPayment && (
            <>
              <div data-testid="payment-recipient-invoice" className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-[12px] text-[#374151]">
                <p><strong>Beneficiary:</strong> {config.invoiceBeneficiaryName}</p>
                <p className="mt-1"><strong>Interac / remittance:</strong> {config.invoiceRecipientEmail}</p>
                <p className="mt-1 text-[11.5px] text-[#6b7280]">{config.invoiceBankDetails}</p>
              </div>
              <label className="block"><span className={cqaLabel}>Invoice / PO reference</span><input className={cqaInput} value={invoiceReference} onChange={(e) => setInvoiceReference(e.target.value)} placeholder="PO-2026-0042" /></label>
            </>
          )}
          {!needsPayment && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">The 12-week free pilot starts immediately with 3,000 credits. No card is charged.</p>}
          {checkoutError && <p className="text-[12px] text-red-600">{checkoutError}</p>}
        </div>
      </Modal>
    </div>
  );
}
