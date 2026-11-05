"use client";

import { Textarea } from "@/components/ui/Textarea";
import { APP_DESCRIPTION_MAX, APP_DESCRIPTION_MIN } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { useStepSubmit } from "./hooks";
import { StepFooter, StepShell } from "./StepShell";

const EXAMPLE =
  "We're building a B2B invoicing web app. Customers sign up with email or Google SSO, create clients, " +
  "send invoices, accept card payments through Stripe and export reports as CSV. The most critical flows " +
  "are sign-up, invoice creation, payment and the monthly report. Admins can invite teammates with roles.";

/** Étape 1 — "Tell us what you're building" (texte libre, 2500 caractères max). */
export function StepDescribe() {
  const { state, patch } = useOnboarding();
  const { submit, pending, error } = useStepSubmit();
  const length = state.appDescription.trim().length;

  return (
    <StepShell step={1}>
      <Textarea
        label="Describe your application"
        value={state.appDescription}
        maxLength={APP_DESCRIPTION_MAX}
        onChange={(e) => patch({ appDescription: e.target.value })}
        placeholder="What does your product do? Who uses it? Which flows must never break?"
        hint={length < APP_DESCRIPTION_MIN ? `At least ${APP_DESCRIPTION_MIN} characters` : "Looks good"}
        autoFocus
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Not sure what to write?</span>
        <button
          type="button"
          onClick={() => patch({ appDescription: EXAMPLE })}
          className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          Use an example
        </button>
      </div>

      <StepFooter
        step={1}
        pending={pending}
        error={error}
        disabled={length < APP_DESCRIPTION_MIN}
        onContinue={() => submit({ step: 1, appDescription: state.appDescription })}
      />
    </StepShell>
  );
}
