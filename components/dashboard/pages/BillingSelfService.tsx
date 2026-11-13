"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaCard, cqaInput, cqaLabel } from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export interface BillingMember {
  id: string;
  name: string;
  email: string;
  role: string;
  creditQuota: number;
  creditsConsumed: number;
}

const CREDIT_PACKS = [50_000, 250_000, 1_000_000];
const PLAN_OPTIONS = [
  { key: "trial", label: "12-Week Free Pilot" },
  { key: "starter", label: "Starter · $99/mo" },
  { key: "pro", label: "Team / Pro · $299/mo" },
  { key: "enterprise", label: "Enterprise · Custom SLA" },
];

export function BillingSelfService({ readOnly, members, plan }: { readOnly: boolean; members: BillingMember[]; plan: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"credits" | "plan" | "quota" | null>(null);
  const [pending, setPending] = useState(false);
  const [credits, setCredits] = useState(50_000);
  const [customCredits, setCustomCredits] = useState("");
  const [planKey, setPlanKey] = useState(plan === "pro" ? "pro" : plan);
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [quota, setQuota] = useState(String(members[0]?.creditQuota ?? 25_000));
  const [method, setMethod] = useState<"stripe" | "paypal" | "invoice">("stripe");
  const [cardholder, setCardholder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");

  function validPayment() {
    if (method === "stripe") return cardholder.trim().length >= 2 && cardNumber.replace(/\s/g, "").length >= 12;
    if (method === "paypal") return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paypalEmail);
    return invoiceReference.trim().length >= 2;
  }

  async function submit() {
    setPending(true);
    try {
      if (mode === "credits") {
        const amount = customCredits ? Number(customCredits) : credits;
        await apiFetch("/api/dashboard/billing", {
          method: "POST",
          json: { action: "credits", credits: amount, method, cardholder, cardNumber, paypalEmail, invoiceReference },
        });
        toast(`${amount.toLocaleString("en-US")} credits added to the workspace.`, "success");
      } else if (mode === "plan") {
        await apiFetch("/api/dashboard/billing", {
          method: "POST",
          json: { action: "checkout", plan: planKey, method, cardholder, cardNumber, paypalEmail, invoiceReference, credits: 0 },
        });
        toast(`Plan activated: ${PLAN_OPTIONS.find((item) => item.key === planKey)?.label}.`, "success");
      } else if (mode === "quota") {
        const result = await apiFetch<{ member: BillingMember }>("/api/dashboard/billing", {
          method: "POST",
          json: { action: "allocation", userId: memberId, quota: Number(quota) || 0 },
        });
        toast(`Token quota set to ${result.member.creditQuota.toLocaleString("en-US")} for ${result.member.email}.`, "success");
      }
      setMode(null);
      router.refresh();
    } catch (caught) {
      toast(errorMessage(caught), "error");
    } finally {
      setPending(false);
    }
  }

  const paymentFields = (
    <div className="space-y-3">
      <label className="block">
        <span className={cqaLabel}>Payment method</span>
        <select className={cqaInput} value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
          <option value="stripe">Credit / debit card · Stripe</option>
          <option value="paypal">PayPal</option>
          <option value="invoice">Enterprise invoice / PO</option>
        </select>
      </label>
      {method === "stripe" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={cqaLabel}>Cardholder</span><input className={cqaInput} value={cardholder} onChange={(e) => setCardholder(e.target.value)} placeholder="Jane Cooper" /></label>
          <label className="block"><span className={cqaLabel}>Card number</span><input className={cqaInput} value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" inputMode="numeric" /></label>
        </div>
      )}
      {method === "paypal" && <label className="block"><span className={cqaLabel}>PayPal account</span><input className={cqaInput} value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="billing@company.com" /></label>}
      {method === "invoice" && <label className="block"><span className={cqaLabel}>Invoice / PO reference</span><input className={cqaInput} value={invoiceReference} onChange={(e) => setInvoiceReference(e.target.value)} placeholder="PO-2026-0042" /></label>}
    </div>
  );

  return (
    <section className={cn(cqaCard, "p-4")} data-testid="billing-self-service">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-[#111827]">Workspace billing & token governance</h2>
          <p className="mt-1 text-[12px] text-[#6b7280]">Buy tokens, change plans with validated payment, and allocate quotas to teammates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => setMode("credits")}>Buy Additional Credits</button>
          <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => setMode("plan")}>Upgrade / Change Plan</button>
          <button type="button" className={cqaBtnPrimary} disabled={readOnly || members.length === 0} onClick={() => setMode("quota")}>Allocate Tokens</button>
        </div>
      </div>

      {members.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#eef0f3]">
          <table className="w-full min-w-[520px] text-left text-[12px]">
            <thead className="bg-[#fafafa] text-[10.5px] uppercase tracking-wide text-[#9ca3af]">
              <tr><th className="px-3 py-2">Member</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Allocated</th><th className="px-3 py-2">Consumed</th><th className="px-3 py-2">Remaining</th></tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-[#f3f4f6]">
                  <td className="px-3 py-2"><p className="font-medium text-[#111827]">{member.name}</p><p className="text-[10.5px] text-[#9ca3af]">{member.email}</p></td>
                  <td className="px-3 py-2 text-[#4b5563]">{member.role}</td>
                  <td className="px-3 py-2 tabular-nums">{member.creditQuota.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2 tabular-nums">{member.creditsConsumed.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2 tabular-nums font-medium text-[#067647]">{Math.max(0, member.creditQuota - member.creditsConsumed).toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={mode === "credits"}
        onClose={() => setMode(null)}
        title="Buy additional credits"
        footer={<><button type="button" className={cqaBtnSecondary} onClick={() => setMode(null)}>Cancel</button><button type="button" data-testid="buy-credits-submit" className={cqaBtnPrimary} disabled={pending || !validPayment()} onClick={() => void submit()}>{pending ? "Processing…" : "Purchase credits"}</button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {CREDIT_PACKS.map((pack) => <button key={pack} type="button" onClick={() => { setCredits(pack); setCustomCredits(""); }} className={cn("rounded-lg border px-2 py-2 text-[12px] font-semibold", credits === pack && !customCredits ? "border-[#5b4ee8] bg-[#eef2ff] text-[#4f46e5]" : "border-[#e5e7eb] bg-white text-[#4b5563]")}>+{pack.toLocaleString("en-US")}</button>)}
          </div>
          <label className="block"><span className={cqaLabel}>Custom amount</span><input className={cqaInput} type="number" min={1000} value={customCredits} onChange={(e) => setCustomCredits(e.target.value)} placeholder="e.g. 750000" /></label>
          <p className="text-[11px] text-[#6b7280]">Rate: $0.025 / credit · charged amount ${(((customCredits ? Number(customCredits) : credits) * 0.025)).toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
          {paymentFields}
        </div>
      </Modal>

      <Modal
        open={mode === "plan"}
        onClose={() => setMode(null)}
        title="Upgrade / change plan"
        footer={<><button type="button" className={cqaBtnSecondary} onClick={() => setMode(null)}>Cancel</button><button type="button" data-testid="upgrade-plan-submit" className={cqaBtnPrimary} disabled={pending || !validPayment()} onClick={() => void submit()}>{pending ? "Activating…" : "Activate plan"}</button></>}
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {PLAN_OPTIONS.map((option) => <button key={option.key} type="button" onClick={() => setPlanKey(option.key)} className={cn("rounded-lg border px-3 py-2 text-left text-[12px] font-semibold", planKey === option.key ? "border-[#5b4ee8] bg-[#eef2ff] text-[#4f46e5]" : "border-[#e5e7eb] bg-white text-[#374151]")}>{option.label}</button>)}
          </div>
          {paymentFields}
        </div>
      </Modal>

      <Modal
        open={mode === "quota"}
        onClose={() => setMode(null)}
        title="Allocate tokens to a teammate"
        footer={<><button type="button" className={cqaBtnSecondary} onClick={() => setMode(null)}>Cancel</button><button type="button" data-testid="allocate-tokens-submit" className={cqaBtnPrimary} disabled={pending || !memberId} onClick={() => void submit()}>{pending ? "Saving…" : "Save allocation"}</button></>}
      >
        <div className="space-y-3">
          <label className="block"><span className={cqaLabel}>Team member</span><select className={cqaInput} value={memberId} onChange={(e) => { setMemberId(e.target.value); const member = members.find((item) => item.id === e.target.value); setQuota(String(member?.creditQuota ?? 0)); }}>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label>
          <label className="block"><span className={cqaLabel}>Token quota</span><input className={cqaInput} type="number" min={0} value={quota} onChange={(e) => setQuota(e.target.value)} /></label>
          <p className="text-[11px] text-[#6b7280]">Consumed tokens are tracked per member and cannot exceed the quota.</p>
        </div>
      </Modal>
    </section>
  );
}
