"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { STEPS, TOTAL_STEPS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** "STEP n OF 7 · KICKER" header with a segmented progress bar. */
export function StepHeader({ step, title, subtitle }: { step: number; title: React.ReactNode; subtitle?: React.ReactNode }) {
  const meta = STEPS[step - 1];
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((s) => (
          <span key={s.n} className={cn("h-1 flex-1 rounded-full", s.n <= step ? "bg-brand-600" : "bg-slate-200")} />
        ))}
      </div>
      <p className="mt-6 text-[11px] font-semibold tracking-[0.16em] text-brand-600">
        STEP {step} OF {TOTAL_STEPS} · {meta.kicker}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-500">{subtitle}</p>}
    </div>
  );
}

/** Back / Skip / Continue row. */
export function StepFooter({
  step,
  onContinue,
  onSkip,
  continueLabel = "Continue",
  canContinue = true,
  pending,
  error,
}: {
  step: number;
  onContinue: () => void;
  onSkip?: () => void;
  continueLabel?: string;
  canContinue?: boolean;
  pending: "continue" | "skip" | null;
  error?: string | null;
}) {
  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-6">
        {step > 1 ? (
          <Link href={`/onboarding/${step - 1}`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} loading={pending === "skip"} disabled={pending !== null}>
              Skip for now
            </Button>
          )}
          <Button onClick={onContinue} loading={pending === "continue"} loadingText="Saving…" disabled={!canContinue || pending !== null}>
            {continueLabel} →
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Selectable chip / segmented option. */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition",
        active ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      )}
    >
      {children}
    </button>
  );
}

/** Horizontal segmented bar (role, testing maturity). */
export function SegmentBar<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-2 grid rounded-xl border border-slate-200 bg-slate-50 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm",
              value === option ? "bg-white text-brand-700 shadow-sm ring-1 ring-brand-200" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
