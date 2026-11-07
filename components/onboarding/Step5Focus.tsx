"use client";

import { FOCUS_OPTIONS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { cn } from "@/lib/utils";
import { useSaveStep } from "./hooks";
import { StepFooter, StepHeader } from "./StepChrome";

export function Step5Focus() {
  const { state, patch } = useOnboarding();
  const { save, pending, error } = useSaveStep();

  return (
    <div className="space-y-8">
      <StepHeader step={5} title="Where should QASyn focus first?" subtitle="Pick one priority. Everything else stays on, this only sets the order." />
      <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
        {FOCUS_OPTIONS.map((option) => {
          const active = state.focusPriority === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => patch({ focusPriority: option.key })}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                active ? "border-brand-500 bg-brand-50/60 ring-4 ring-brand-100" : "border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <p className="text-sm font-semibold text-slate-900">{option.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{option.description}</p>
            </button>
          );
        })}
      </div>
      <StepFooter
        step={5}
        pending={pending}
        error={error}
        canContinue={state.focusPriority !== null}
        onSkip={() => save({ step: 5, skip: true }, "skip")}
        onContinue={() => save({ step: 5, focusPriority: state.focusPriority })}
      />
    </div>
  );
}
