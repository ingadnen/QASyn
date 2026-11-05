"use client";

import { FOCUS_OPTIONS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { cn } from "@/lib/utils";
import { useStepSubmit } from "./hooks";
import { StepFooter, StepShell } from "./StepShell";

/** Étape 5 — "Choose a priority". */
export function StepFocus() {
  const { state, patch } = useOnboarding();
  const { submit, pending, error } = useStepSubmit();

  return (
    <StepShell step={5}>
      <div role="radiogroup" aria-label="Priority" className="grid gap-3 sm:grid-cols-2">
        {FOCUS_OPTIONS.map((option, index) => {
          const selected = state.focus === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => patch({ focus: option.key })}
              className={cn(
                "rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                selected
                  ? "border-brand-500 bg-brand-50/60 ring-4 ring-brand-100"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
              )}
            >
              <span className="font-mono text-[11px] font-medium text-brand-500">0{index + 1}</span>
              <span className="mt-1 block text-sm font-semibold text-slate-900">{option.label}</span>
              <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
            </button>
          );
        })}
      </div>

      <StepFooter
        step={5}
        pending={pending}
        error={error}
        disabled={!state.focus}
        onContinue={() => state.focus && submit({ step: 5, focus: state.focus })}
      />
    </StepShell>
  );
}
