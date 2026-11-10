"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CqaIcon,
  ErrorNote,
  Modal,
  cqaBtnPrimary,
  cqaBtnSecondary,
  cqaCard,
  cqaIconBtn,
  cqaInput,
  cqaLabel,
  useAction,
} from "@/components/dashboard/ui";
import { CREDIT_ACTIONS } from "@/lib/credits";
import { cn } from "@/lib/utils";

export interface CreditLedgerRow {
  id: string;
  occurredAt: string;
  action: string;
  credits: number;
  kind: string;
  note: string | null;
}

const RANGES = ["Last 7 days", "Last 30 days", "This billing period", "Custom range"] as const;
type Range = (typeof RANGES)[number];

const DAY = 86_400_000;
const MINUS = "âˆ’";

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function shortDay(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function longDay(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ledgerDay(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time}`;
}

function signed(value: number) {
  if (value === 0) return "0";
  return value > 0 ? `+${value.toLocaleString("en-US")}` : `${MINUS}${Math.abs(value).toLocaleString("en-US")}`;
}

function creditLine(value: number) {
  if (value === 0) return "0 credits";
  return `${signed(value)} credits`;
}

function actionIcon(action: string) {
  const map: Record<string, string> = {
    "Autonomous crawl": "travel_explore",
    "Web test run": "play_arrow",
    "Web test execution": "play_arrow",
    "Mobile test execution": "smartphone",
    "API test execution": "api",
    "Root cause analysis": "troubleshoot",
    "Bug reproduction": "bug_report",
    "Pull-request analysis": "merge",
    "Code analysis": "code",
    "Self-healing": "healing",
    "AI-Insight session": "lightbulb",
    "Knowledge base sync": "sync",
    "Requirement upload": "upload_file",
    "Credit refund": "undo",
  };
  return map[action] ?? "bolt";
}

const PLAN_CARDS = [
  {
    key: "starter",
    name: "Starter",
    price: "$49",
    cadence: "/ month",
    features: ["2,000 credits / month", "15-day free trial", "Billed monthly"],
    cta: "Select Starter",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$249",
    cadence: "/ month",
    features: ["12,000 credits / month", "15-day free trial", "Billed monthly"],
    cta: "Select Pro",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    features: ["Unlimited repositories", "SSO & audit log", "Custom limits", "Priority support"],
    cta: "Talk to sales",
  },
] as const;

function Check() {
  return <CqaIcon name="check" className="text-[15px] text-[#5b4ee8]" />;
}

function StatCell({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-[#f0f1f3] bg-[#fafafa] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[#6b7280]">
        <CqaIcon name={icon} className="text-[15px]" />
        <span className="text-[11px] uppercase tracking-[0.05em]">Credits</span>
      </div>
      <p className="mt-1 text-[13px] font-semibold text-[#111827]">{value}</p>
      <p className="text-[11.5px] text-[#9ca3af]">{label}</p>
    </div>
  );
}

export function BillingUsage(props: BillingUsageProps) {
  const {
    orgName,
    plan,
    readOnly,
    trialCredits,
    creditsUsed,
    paymentMethod,
    trialStartsAt,
    trialEndsAt,
    entries,
    view,
  } = props;
  const { run, pending, error, setError } = useAction();
  const [plansOpen, setPlansOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const available = Math.max(0, trialCredits - creditsUsed);
  const trialStart = new Date(trialStartsAt);
  const trialEnd = new Date(trialEndsAt);
  const trialLength = Math.max(1, Math.round((trialEnd.getTime() - trialStart.getTime()) / DAY));
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / DAY));
  const dayNumber = Math.min(trialLength, Math.max(1, Math.floor((Date.now() - trialStart.getTime()) / DAY) + 1));
  const isTrial = plan === "trial" || plan === "free";
  const planName = isTrial ? "Free trial" : plan.charAt(0).toUpperCase() + plan.slice(1);
  const planPrice = plan === "starter" ? "$49" : plan === "pro" ? "$249" : isTrial ? "$0" : "Custom";
  const planLabel = isTrial ? `Trial Â· ${daysLeft} days left` : `${planName} plan`;

  async function choosePlan(key: string) {
    if (key === "enterprise") {
      window.location.href = "mailto:sales@qasyn.com";
      return;
    }
    await run(`plan-${key}`, "/api/dashboard/billing", { json: { action: "plan", plan: key } });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-[#111827]">Billing &amp; usage</h1>
        <p className="mt-1 text-[13.5px] leading-5 text-[#6b7280]">
          Credits for {orgName} Â· what you were granted, what was consumed, and what it was spent on.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-[#e5e7eb]">
        <Link
          href="/dashboard/billing"
          className={cn(
            "-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition",
            view === "billing"
              ? "border-[#5b4ee8] text-[#5b4ee8]"
              : "border-transparent text-[#6b7280] hover:text-[#111827]",
          )}
        >
          Billing
        </Link>
        <Link
          href="/dashboard/billing/usage"
          className={cn(
            "-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition",
            view === "usage"
              ? "border-[#5b4ee8] text-[#5b4ee8]"
              : "border-transparent text-[#6b7280] hover:text-[#111827]",
          )}
        >
          Usage
        </Link>
      </div>

      <ErrorNote error={error} />

      {view === "billing" ? (
        <BillingView
          orgName={orgName}
          planName={planName}
          planLabel={planLabel}
          planPrice={planPrice}
          available={available}
          trialCredits={trialCredits}
          creditsUsed={creditsUsed}
          trialStart={trialStart}
          trialEnd={trialEnd}
          trialLength={trialLength}
          dayNumber={dayNumber}
          daysLeft={daysLeft}
          isTrial={isTrial}
          paymentMethod={paymentMethod}
          entries={entries}
          plansOpen={plansOpen}
          onTogglePlans={() => setPlansOpen((value) => !value)}
          onSelectPlan={(key) => void choosePlan(key)}
          planPending={pending}
          readOnly={readOnly}
          onPayment={() => {
            setError(null);
            setPaymentOpen(true);
          }}
        />
      ) : (
        <UsageView available={available} entries={entries} orgName={orgName} />
      )}

      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Add payment method"
        footer={null}
        size="sm"
      >
        <PaymentForm
          readOnly={readOnly}
          current={paymentMethod}
          onDone={() => setPaymentOpen(false)}
        />
      </Modal>
    </div>
  );
}

interface BillingUsageProps {
  orgName: string;
  plan: string;
  readOnly: boolean;
  trialCredits: number;
  creditsUsed: number;
  paymentMethod: string | null;
  trialStartsAt: string;
  trialEndsAt: string;
  entries: CreditLedgerRow[];
  view: "billing" | "usage";
}

function BillingView({
  orgName,
  planName,
  planLabel,
  planPrice,
  available,
  trialCredits,
  creditsUsed,
  trialStart,
  trialEnd,
  trialLength,
  dayNumber,
  daysLeft,
  isTrial,
  paymentMethod,
  entries,
  plansOpen,
  onTogglePlans,
  onSelectPlan,
  planPending,
  readOnly,
  onPayment,
}: {
  orgName: string;
  planName: string;
  planLabel: string;
  planPrice: string;
  available: number;
  trialCredits: number;
  creditsUsed: number;
  trialStart: Date;
  trialEnd: Date;
  trialLength: number;
  dayNumber: number;
  daysLeft: number;
  isTrial: boolean;
  paymentMethod: string | null;
  entries: CreditLedgerRow[];
  plansOpen: boolean;
  onTogglePlans: () => void;
  onSelectPlan: (key: string) => void;
  planPending: string | null;
  readOnly: boolean;
  onPayment: () => void;
}) {
  const consumed = Math.abs(entries.filter((entry) => entry.credits < 0).reduce((sum, entry) => sum + entry.credits, 0));
  const periodKey = `t${trialStart.getFullYear()}-${String(trialStart.getMonth() + 1).padStart(2, "0")}-${String(trialStart.getDate()).padStart(2, "0")}`;
  const [historyPageSize, setHistoryPageSize] = useState(25);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={cn(cqaCard, "p-4")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-[#111827]">Available credits</h2>
              <p className="mt-3 text-[32px] font-semibold leading-none tracking-[-0.02em] text-[#111827]">
                {available.toLocaleString("en-US")}
              </p>
              <p className="mt-1 text-[12px] text-[#9ca3af]">credits</p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-full bg-[#f5f3ff] text-[#5b4ee8]">
              <CqaIcon name="account_balance_wallet" className="text-[20px]" />
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[18px] font-semibold text-[#111827]">{available.toLocaleString("en-US")}</p>
              <p className="text-[11.5px] text-[#6b7280]">
                plan credits Â· resets {shortDay(trialEnd)}
              </p>
            </div>
            <div>
              <p className="text-[18px] font-semibold text-[#111827]">0</p>
              <p className="text-[11.5px] text-[#6b7280]">additional Â· no expiry</p>
            </div>
          </div>
          <p className="mt-3 border-t border-[#f0f1f3] pt-3 text-[11.5px] leading-4 text-[#9ca3af]">
            Plan credits are used first. Additional credits are used afterward and do not expire.
          </p>
          <div className="mt-3">
            <Link href="/dashboard/billing/usage" className={cqaBtnSecondary}>
              <CqaIcon name="bar_chart" className="text-[16px]" /> View usage
            </Link>
          </div>
        </section>

        <section className={cn(cqaCard, "p-4")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#9ca3af]">Current plan</p>
              <div className="mt-2 flex items-center gap-2 text-[#111827]">
                <CqaIcon name="schedule" className="text-[18px] text-[#5b4ee8]" />
                <p className="text-[15px] font-semibold">{planLabel}</p>
              </div>
              <p className="mt-1 text-[13px] text-[#374151]">{isTrial ? `${trialLength}-day free trial` : `${planName} plan`}</p>
              <p className="text-[24px] font-semibold leading-8 text-[#111827]">{planPrice}</p>
              <p className="text-[11.5px] text-[#6b7280]">
                {isTrial
                  ? `${shortDay(trialStart)} â€“ ${shortDay(trialEnd)} Â· no card required during the trial`
                  : `Billed monthly Â· renews ${shortDay(trialEnd)}`}
              </p>
            </div>
            <div className="rounded-lg bg-[#f5f3ff] px-3 py-2 text-center">
              <p className="text-[20px] font-semibold leading-6 text-[#5b4ee8]">{daysLeft}</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#7c6ff0]">days</p>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] text-[#9ca3af]">
            Day {dayNumber} of {trialLength} Â· {daysLeft} days left Â· ends {shortDay(trialEnd)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatCell icon="account_balance_wallet" value={`${available.toLocaleString("en-US")} credits`} label="available now" />
            <StatCell icon="redeem" value={`${trialCredits.toLocaleString("en-US")} credits`} label="granted this period" />
            <StatCell icon="trending_down" value={`${creditsUsed.toLocaleString("en-US")} credits`} label="used this period" />
            <StatCell icon="savings" value="0 credits" label="do not expire" />
          </div>
          <div className="mt-3">
            <button type="button" className={cqaBtnPrimary} onClick={onTogglePlans}>
              Choose a plan
            </button>
          </div>
        </section>
      </div>

      <section className={cn(cqaCard, "p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold text-[#111827]">Payment</h2>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#9ca3af]">
              <CqaIcon name="lock" className="text-[14px]" /> Handled by Stripe
            </div>
          </div>
          <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={onPayment}>
            {paymentMethod ? "Update in Stripe" : "Add in Stripe"}
          </button>
        </div>
        <p className="mt-3 text-[13px] text-[#374151]">
          {paymentMethod ?? "No payment method yet. Not required during the trial."}
        </p>
        <p className="mt-1 text-[11.5px] text-[#9ca3af]">QASyn never stores card details. All payment data lives with Stripe.</p>
      </section>

      {plansOpen && (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold text-[#111827]">Plans</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className={cn(cqaCard, "flex flex-col border-[#ddd6fe] p-4")}>
              <span className="self-start rounded-full bg-[#f5f3ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5b4ee8]">
                Current
              </span>
              <h3 className="mt-2 text-[15px] font-semibold text-[#111827]">{planName}</h3>
              <p className="text-[24px] font-semibold leading-8 text-[#111827]">
                {planPrice} <span className="text-[12px] font-normal text-[#9ca3af]">/ month</span>
              </p>
              <ul className="mt-3 flex-1 space-y-2 text-[12.5px] text-[#4b5563]">
                <li className="flex items-start gap-2"><Check /> {trialCredits.toLocaleString("en-US")} credits</li>
                <li className="flex items-start gap-2"><Check /> {trialLength}-day free trial</li>
              </ul>
              <button type="button" disabled className={cn(cqaBtnSecondary, "mt-4 w-full justify-center opacity-60")}>
                Current Plan
              </button>
            </article>

            {PLAN_CARDS.map((card) => (
              <article key={card.key} className={cn(cqaCard, "flex flex-col p-4")}>
                <h3 className="mt-5 text-[15px] font-semibold text-[#111827]">{card.name}</h3>
                <p className="text-[24px] font-semibold leading-8 text-[#111827]">
                  {card.price} <span className="text-[12px] font-normal text-[#9ca3af]">{card.cadence}</span>
                </p>
                <ul className="mt-3 flex-1 space-y-2 text-[12.5px] text-[#4b5563]">
                  {card.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2"><Check /> {feature}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={cn(cqaBtnSecondary, "mt-4 w-full justify-center")}
                  disabled={readOnly || planPending === `plan-${card.key}`}
                  onClick={() => onSelectPlan(card.key)}
                >
                  {planPending === `plan-${card.key}` ? "Selectingâ€¦" : card.cta}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className={cn(cqaCard, "overflow-hidden")}>
        <div className="px-4 pt-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">Credit history</h2>
          <p className="mt-1 text-[12px] text-[#9ca3af]">One row per credit grant, newest first.</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="border-y border-[#e5e7eb] bg-[#fafafa] text-[10.5px] uppercase tracking-[0.06em] text-[#9ca3af]">
              <tr>
                {["Period", "Event", "Granted", "Consumed", "Expired unused", "Paid", "Created"].map((column) => (
                  <th key={column} className="px-4 py-2 font-medium">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#f3f4f6]">
                <td className="px-4 py-3 font-mono text-[11.5px] text-[#374151]">{periodKey}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-[#374151]">
                    <CqaIcon name="calendar_month" className="text-[15px] text-[#9ca3af]" />
                    {isTrial ? "Trial" : planName}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#374151]">{trialCredits.toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-[#374151]">{consumed.toLocaleString("en-US")}</td>
                <td className="px-4 py-3 text-[#9ca3af]">â€”</td>
                <td className="px-4 py-3 text-[#9ca3af]">â€”</td>
                <td className="px-4 py-3 text-[#6b7280]">{longDay(trialStart)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#f0f1f3] px-4 py-2.5 text-[11.5px] text-[#6b7280]">
          <span className="mr-auto tabular-nums">1â€“1 of 1</span>
          <span>Rows per page</span>
          <select
            aria-label="Credit history rows per page"
            className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[12px]"
            value={historyPageSize}
            onChange={(event) => setHistoryPageSize(Number(event.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </section>
    </div>
  );
}

function UsageView({ available, entries, orgName }: { available: number; entries: CreditLedgerRow[]; orgName: string }) {
  const [range, setRange] = useState<Range>("Last 7 days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [actionFilter, setActionFilter] = useState("All actions");
  const [mode, setMode] = useState<"ledger" | "action">("ledger");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);

  const { start, end } = useMemo(() => {
    const today = startOfDay(new Date());
    if (range === "Last 30 days") return { start: addDays(today, -29), end: today };
    if (range === "This billing period") {
      const first = entries.length
        ? startOfDay(new Date(Math.min(...entries.map((entry) => new Date(entry.occurredAt).getTime()))))
        : addDays(today, -29);
      return { start: first, end: today };
    }
    if (range === "Custom range" && customFrom && customTo) {
      return { start: startOfDay(new Date(`${customFrom}T00:00:00`)), end: startOfDay(new Date(`${customTo}T00:00:00`)) };
    }
    return { start: addDays(today, -6), end: today };
  }, [range, customFrom, customTo, entries]);

  const inRange = useMemo(
    () =>
      entries.filter((entry) => {
        const time = new Date(entry.occurredAt).getTime();
        return time >= start.getTime() && time <= end.getTime() + DAY - 1;
      }),
    [entries, start, end],
  );

  const filtered = useMemo(
    () => (actionFilter === "All actions" ? inRange : inRange.filter((entry) => entry.action === actionFilter)),
    [inRange, actionFilter],
  );

  const used = Math.abs(
    filtered.filter((entry) => entry.kind !== "refund" && entry.credits < 0).reduce((sum, entry) => sum + entry.credits, 0),
  );
  const refunded = filtered.filter((entry) => entry.kind === "refund").reduce((sum, entry) => sum + entry.credits, 0);

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
      list.push(new Date(cursor));
    }
    return list.slice(-31);
  }, [start, end]);

  const perDay = useMemo(() => {
    return days.map((day) => {
      const key = day.toDateString();
      const total = inRange
        .filter((entry) => entry.kind !== "refund" && entry.credits < 0 && new Date(entry.occurredAt).toDateString() === key)
        .reduce((sum, entry) => sum + Math.abs(entry.credits), 0);
      return { day, total };
    });
  }, [days, inRange]);

  const maxDay = Math.max(1, ...perDay.map((item) => item.total));

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const paged = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeLabel = `${shortDay(start)} â€“ ${shortDay(end)}`;

  const groups = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const entry of filtered) {
      if (entry.kind === "refund") continue;
      const group = map.get(entry.action) ?? { count: 0, total: 0 };
      group.count += 1;
      group.total += entry.credits;
      map.set(entry.action, group);
    }
    const list = [...map.entries()]
      .filter(([, value]) => value.total !== 0)
      .map(([action, value]) => ({ action, ...value, icon: actionIcon(action) }));
    if (refunded !== 0) {
      list.push({
        action: "Credit refund",
        count: filtered.filter((entry) => entry.kind === "refund").length,
        total: refunded,
        icon: "undo",
      });
    }
    return list.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  }, [filtered, refunded]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-[#111827]">Usage</h2>
          <p className="mt-0.5 text-[12.5px] text-[#6b7280]">Track how your workspace uses QASyn credits.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] text-[#9ca3af]">
            {rangeLabel} Â· {inRange.length} {inRange.length === 1 ? "entry" : "entries"}
          </span>
          <select
            aria-label="Usage date range"
            className={cn(cqaInput, "h-8 w-[160px] py-0 text-[12px]")}
            value={range}
            onChange={(event) => {
              setRange(event.target.value as Range);
              setPage(0);
            }}
          >
            {RANGES.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
      </div>

      {range === "Custom range" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className={cqaLabel}>From</span>
            <input type="date" className={cn(cqaInput, "h-8 py-0")} value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
          </label>
          <label className="block">
            <span className={cqaLabel}>To</span>
            <input type="date" className={cn(cqaInput, "h-8 py-0")} value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
          </label>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <section className={cn(cqaCard, "p-4")}>
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#6b7280]">
            <CqaIcon name="bolt" className="text-[15px] text-[#5b4ee8]" /> Available balance
          </div>
          <p className="mt-2 text-[26px] font-semibold leading-8 text-[#111827]">{available.toLocaleString("en-US")}</p>
          <p className="text-[11.5px] text-[#9ca3af]">credits</p>
          <p className="mt-1 text-[11px] text-[#9ca3af]">Workspace-wide Â· unaffected by the date filter</p>
        </section>
        <section className={cn(cqaCard, "p-4")}>
          <p className="text-[11.5px] font-medium text-[#6b7280]">Used Â· last 7 days</p>
          <p className="mt-2 text-[26px] font-semibold leading-8 text-[#111827]">{MINUS}{used.toLocaleString("en-US")}</p>
          <p className="text-[11.5px] text-[#9ca3af]">credits</p>
        </section>
        <section className={cn(cqaCard, "p-4")}>
          <p className="text-[11.5px] font-medium text-[#6b7280]">Refunded Â· last 7 days</p>
          <p className="mt-2 text-[26px] font-semibold leading-8 text-[#00a63e]">+{refunded.toLocaleString("en-US")}</p>
          <p className="text-[11.5px] text-[#9ca3af]">credits</p>
        </section>
      </div>

      <section className={cn(cqaCard, "p-4")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-[#111827]">Credits used per day</h2>
            <p className="mt-0.5 text-[11.5px] text-[#9ca3af]">{rangeLabel}</p>
          </div>
          <p className="text-[11.5px] text-[#9ca3af]">{orgName}</p>
        </div>
        <div className="mt-5 flex h-[150px] items-end gap-2 overflow-x-auto pb-1">
          {perDay.map(({ day, total }) => {
            const label = day.toDateString() === new Date().toDateString()
              ? "Today"
              : day.toDateString() === addDays(startOfDay(new Date()), -1).toDateString()
                ? "Yesterday"
                : shortDay(day);
            const height = total ? Math.max(8, Math.round((total / maxDay) * 112)) : 2;
            return (
              <div key={day.toISOString()} className="flex min-w-[52px] flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] text-[#9ca3af]">{total ? `${MINUS}${total}` : ""}</span>
                <div
                  title={`${label} Â· ${total ? `${MINUS}${total} credits` : "no credits used"}`}
                  className={cn("w-full max-w-[36px] rounded-t-[4px]", total ? "bg-[#5b4ee8]" : "bg-[#e5e7eb]")}
                  style={{ height }}
                />
                <span className="text-[10px] text-[#9ca3af]">{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className={cn(cqaCard, "overflow-hidden")}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
          <div>
            <h2 className="text-[14px] font-semibold text-[#111827]">Credit activity</h2>
            <p className="mt-1 text-[12px] text-[#9ca3af]">One row per charge or refund, newest first.</p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] p-0.5">
            {(["ledger", "action"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11.5px] font-medium transition",
                  mode === item ? "bg-[#f5f3ff] text-[#5b4ee8]" : "text-[#6b7280] hover:text-[#111827]",
                )}
              >
                {item === "ledger" ? "Ledger" : "By action"}
              </button>
            ))}
          </div>
        </div>

        {mode === "ledger" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <select
                aria-label="Filter credit activity by action"
                className={cn(cqaInput, "h-8 w-[190px] py-0 text-[12px]")}
                value={actionFilter}
                onChange={(event) => {
                  setActionFilter(event.target.value);
                  setPage(0);
                }}
              >
                <option>All actions</option>
                {CREDIT_ACTIONS.map((action) => <option key={action}>{action}</option>)}
              </select>
              <span className="text-[11.5px] text-[#9ca3af]">{filtered.length} entries</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-[12px]">
                <tbody>
                  {paged.map((entry) => {
                    const refund = entry.kind === "refund";
                    return (
                      <tr key={entry.id} className="border-t border-[#f3f4f6]">
                        <td className="w-[170px] whitespace-nowrap px-4 py-2.5 text-[11.5px] text-[#9ca3af]">{ledgerDay(entry.occurredAt)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-[#111827]">{entry.action}</span>
                            {refund && (
                              <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#f0fdf4] px-1.5 py-0.5 text-[10px] font-medium text-[#00a63e]">
                                <CqaIcon name="undo" className="text-[12px]" /> Refunded
                              </span>
                            )}
                          </div>
                          <p className={cn("mt-0.5 text-[11px]", refund ? "text-[#00a63e]" : "text-[#9ca3af]")}>
                            {refund ? `${signed(entry.credits)} credits, refunded` : creditLine(entry.credits)}
                          </p>
                        </td>
                        <td className={cn("w-[110px] whitespace-nowrap px-4 py-2.5 text-right font-medium", entry.credits < 0 ? "text-[#dc2626]" : entry.credits > 0 ? "text-[#00a63e]" : "text-[#6b7280]")}>
                          {signed(entry.credits)}
                        </td>
                      </tr>
                    );
                  })}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-[12px] text-[#9ca3af]">No credit activity in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f1f3] px-4 py-2.5 text-[11.5px] text-[#6b7280]">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-[12px]"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(0);
                  }}
                >
                  {[10, 25, 50, 100].map((size) => <option key={size}>{size}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span>
                  {filtered.length === 0 ? "0" : `${safePage * pageSize + 1}â€“${Math.min(filtered.length, safePage * pageSize + pageSize)}`} of {filtered.length}
                </span>
                <button type="button" className={cqaIconBtn} aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                  <CqaIcon name="chevron_left" className="text-[18px]" />
                </button>
                <button type="button" className={cqaIconBtn} aria-label="Next page" disabled={safePage >= pages - 1} onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}>
                  <CqaIcon name="chevron_right" className="text-[18px]" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2 px-4 pb-4 pt-2">
            {groups.map((group) => (
              <div key={group.action} className="flex items-center gap-3 rounded-lg border border-[#f0f1f3] px-3 py-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#f5f3ff] text-[#5b4ee8]">
                  <CqaIcon name={group.icon} className="text-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-[#111827]">{group.action}</p>
                  <p className="text-[11px] text-[#9ca3af]">{group.count} {group.count === 1 ? "entry" : "entries"}</p>
                </div>
                <span className={cn("text-[12.5px] font-semibold", group.total < 0 ? "text-[#dc2626]" : "text-[#00a63e]")}>{signed(group.total)}</span>
              </div>
            ))}
            <p className="pt-1 text-[11.5px] leading-4 text-[#9ca3af]">
              Share of credits used in last 7 days, across all actions. Switch to Ledger for individual entries.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function PaymentForm({ current, readOnly, onDone }: { current: string | null; readOnly: boolean; onDone: () => void }) {
  const { run, pending, error } = useAction();
  const [cardholder, setCardholder] = useState("");
  const [cardNumber, setCardNumber] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = await run("payment", "/api/dashboard/billing", { json: { action: "payment", cardholder, cardNumber } });
    if (result) onDone();
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <p className="text-[12.5px] text-[#6b7280]">
        Current: <span className="font-medium text-[#374151]">{current ?? "No payment method"}</span>
      </p>
      <label className="block">
        <span className={cqaLabel}>Cardholder</span>
        <input className={cqaInput} value={cardholder} onChange={(event) => setCardholder(event.target.value)} required disabled={readOnly} />
      </label>
      <label className="block">
        <span className={cqaLabel}>Card number</span>
        <input
          className={cqaInput}
          value={cardNumber}
          onChange={(event) => setCardNumber(event.target.value)}
          placeholder="4242 4242 4242 4242"
          required
          disabled={readOnly}
        />
      </label>
      <p className="text-[11px] text-[#9ca3af]">Only the brand and last four digits are stored.</p>
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className={cqaBtnSecondary} onClick={onDone}>Cancel</button>
        <button type="submit" className={cqaBtnPrimary} disabled={readOnly || pending === "payment"}>
          {pending === "payment" ? "Savingâ€¦" : "Save payment method"}
        </button>
      </div>
    </form>
  );
}
