"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { STEPS } from "@/lib/constants";

/** En-tête + contenu + pied de page commun à chaque étape. */
export function StepShell({ step, children }: { step: number; children: React.ReactNode }) {
  const meta = STEPS[step - 1];
  return (
    <section className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{meta.title}</h1>
      <p className="mt-2 text-sm text-slate-500">{meta.subtitle}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export function StepFooter({
  step,
  onContinue,
  disabled,
  pending,
  error,
  continueLabel = "Continue",
  pendingLabel = "Saving…",
}: {
  step: number;
  onContinue: () => void;
  disabled?: boolean;
  pending: boolean;
  error?: string | null;
  continueLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <div className="mt-10 space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
        {step > 1 ? (
          <Link href={`/onboarding/${step - 1}`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back
          </Link>
        ) : (
          <span />
        )}
        <Button size="lg" onClick={onContinue} disabled={disabled} loading={pending} loadingText={pendingLabel}>
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
