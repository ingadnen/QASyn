"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FOCUS_OPTIONS, PROVIDER_META, TRIAL_CREDITS, TRIAL_DAYS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { cn, hostOf } from "@/lib/utils";
import { useSaveStep } from "./hooks";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function Step7Trial() {
  const { state } = useOnboarding();
  const { save, pending, error } = useSaveStep();
  const [review, setReview] = useState(false);

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
          onClick={() => save({ step: 7 }, "skip", "/dashboard/billing?payment=1")}
          loading={pending === "skip"}
          disabled={pending !== null}
        >
          Add payment method
        </Button>
      </div>
    </div>
  );
}
