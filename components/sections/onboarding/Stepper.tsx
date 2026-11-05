"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STEPS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { cn } from "@/lib/utils";

/** Indicateur de progression 1 → 7 ; les étapes débloquées sont cliquables. */
export function Stepper() {
  const pathname = usePathname();
  const { state } = useOnboarding();
  const active = Number(pathname.split("/").at(-1)) || 1;

  return (
    <nav aria-label="Onboarding progress">
      <ol className="flex items-center gap-1.5">
        {STEPS.map((step) => {
          const unlocked = state.completed || step.n <= state.currentStep;
          const done = state.completed || step.n < state.currentStep;
          const isActive = step.n === active;

          const dot = (
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold transition",
                isActive && "bg-brand-600 text-white ring-4 ring-brand-100",
                !isActive && done && "bg-brand-100 text-brand-700",
                !isActive && !done && "bg-slate-100 text-slate-400",
              )}
            >
              {done && !isActive ? "✓" : step.n}
            </span>
          );

          return (
            <li key={step.n} className="flex flex-1 items-center gap-1.5">
              {unlocked ? (
                <Link href={`/onboarding/${step.n}`} aria-current={isActive ? "step" : undefined} title={step.label}>
                  {dot}
                </Link>
              ) : (
                <span title={step.label}>{dot}</span>
              )}
              {step.n < STEPS.length && (
                <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-brand-300" : "bg-slate-100")} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs font-medium text-muted">
        Step {active} of {STEPS.length} · <span className="font-serif text-sm italic text-ink">{STEPS[active - 1]?.label}</span>
      </p>
    </nav>
  );
}
