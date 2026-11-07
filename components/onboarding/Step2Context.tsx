"use client";

import { useOnboarding } from "@/lib/context/OnboardingContext";
import { ONBOARDING_ROLES, PAIN_POINTS, TESTING_MATURITY, type PainPoint } from "@/lib/types";
import { useSaveStep } from "./hooks";
import { Chip, SegmentBar, StepFooter, StepHeader } from "./StepChrome";

export function Step2Context() {
  const { state, patch } = useOnboarding();
  const { save, pending, error } = useSaveStep();

  function toggle(point: PainPoint) {
    patch({
      painPoints: state.painPoints.includes(point) ? state.painPoints.filter((p) => p !== point) : [...state.painPoints, point],
    });
  }

  return (
    <div className="space-y-8">
      <StepHeader step={2} title="A little context" subtitle="This tunes what QASyn looks at first. You can change it later in settings." />

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">What hurts most today?</legend>
        <p className="mt-0.5 text-xs text-slate-500">Pick all that apply.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PAIN_POINTS.map((point) => (
            <Chip key={point} active={state.painPoints.includes(point)} onClick={() => toggle(point)}>
              {point}
            </Chip>
          ))}
        </div>
      </fieldset>

      <SegmentBar label="Your role" options={ONBOARDING_ROLES} value={state.userRole} onChange={(userRole) => patch({ userRole })} />
      <SegmentBar
        label="Testing maturity"
        options={TESTING_MATURITY}
        value={state.testingMaturity}
        onChange={(testingMaturity) => patch({ testingMaturity })}
      />

      <StepFooter
        step={2}
        pending={pending}
        error={error}
        onSkip={() => save({ step: 2, skip: true, painPoints: [] }, "skip")}
        onContinue={() =>
          save({ step: 2, painPoints: state.painPoints, userRole: state.userRole, testingMaturity: state.testingMaturity })
        }
      />
    </div>
  );
}
