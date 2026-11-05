"use client";

import { TRACKER_PROVIDERS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { useIntegrations, useStepSubmit } from "./hooks";
import { IntegrationConnectCard } from "./IntegrationConnectCard";
import { StepFooter, StepShell } from "./StepShell";

/** Étape 4 — "Connect your bug tracker" (Jira, Linear, Slack). */
export function StepBugTracker() {
  const { state } = useOnboarding();
  const { submit, pending, error } = useStepSubmit();
  const integrations = useIntegrations();
  const connected = state.integrations.some((i) => TRACKER_PROVIDERS.includes(i.provider));

  return (
    <StepShell step={4}>
      <div className="grid gap-3 sm:grid-cols-2">
        {TRACKER_PROVIDERS.map((provider) => (
          <IntegrationConnectCard
            key={provider}
            provider={provider}
            integration={integrations.get(provider)}
            busy={integrations.busy === provider}
            onConnect={(detail) => integrations.connect(provider, detail)}
            onDisconnect={() => integrations.disconnect(provider)}
          />
        ))}
      </div>
      {integrations.error && <p className="mt-3 text-xs text-red-600">{integrations.error}</p>}

      <StepFooter
        step={4}
        pending={pending}
        error={error}
        continueLabel={connected ? "Continue" : "Skip for now"}
        onContinue={() => submit({ step: 4 })}
      />
    </StepShell>
  );
}
