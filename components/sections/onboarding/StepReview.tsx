"use client";

import Link from "next/link";
import { FOCUS_OPTIONS, PROVIDER_META, REACH_OPTIONS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { hostOf } from "@/lib/utils";
import { useStepSubmit } from "./hooks";
import { StepFooter, StepShell } from "./StepShell";

/** Étape 7 — récapitulatif et lancement (crée l'historique de runs en base). */
export function StepReview() {
  const { state } = useOnboarding();
  const { submit, pending, error } = useStepSubmit();

  const reach = REACH_OPTIONS.find((r) => r.key === state.reachType);
  const target =
    state.reachType === "LOCALHOST" ? `localhost:${state.localPort}` : hostOf(state.environmentUrl) ?? "—";

  const rows: Array<{ step: number; label: string; value: string }> = [
    {
      step: 1,
      label: "Application",
      value: state.appDescription ? `${state.appDescription.slice(0, 90)}${state.appDescription.length > 90 ? "…" : ""}` : "—",
    },
    { step: 2, label: "Environment", value: reach ? `${reach.label} · ${target}` : "—" },
    {
      step: 3,
      label: "Integrations",
      value:
        state.integrations.map((i) => `${PROVIDER_META[i.provider].name}${i.status === "INDEXING" ? " (indexing)" : ""}`).join(", ") ||
        "None yet",
    },
    { step: 5, label: "Focus", value: FOCUS_OPTIONS.find((f) => f.key === state.focus)?.label ?? "—" },
    { step: 6, label: "Team", value: `${state.teamInvites.length + 1} member${state.teamInvites.length ? "s" : ""}` },
  ];

  return (
    <StepShell step={7}>
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-4 px-4 py-3">
            <dt className="w-28 shrink-0 text-xs font-medium uppercase tracking-wider text-slate-400">{row.label}</dt>
            <dd className="min-w-0 flex-1 text-sm text-slate-800">{row.value}</dd>
            <Link href={`/onboarding/${row.step}`} className="text-xs font-medium text-brand-600 hover:underline">
              Edit
            </Link>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-xl bg-navy-950 p-4 font-mono text-xs text-slate-300">
        <p>
          <span className="text-brand-400">$</span> ship watch --all
        </p>
        <p className="mt-1 text-slate-500">Ship will analyse your latest changes and open the Release Quality Report.</p>
      </div>

      <StepFooter
        step={7}
        pending={pending}
        error={error}
        continueLabel={state.completed ? "Open dashboard" : "Launch Ship"}
        pendingLabel="Launching first analysis…"
        onContinue={() => submit({ step: 7 })}
      />
    </StepShell>
  );
}
