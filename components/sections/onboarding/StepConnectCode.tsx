"use client";

import { CODE_PROVIDERS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { useIntegrations, useStepSubmit } from "./hooks";
import { IntegrationConnectCard } from "./IntegrationConnectCard";
import { StepFooter, StepShell } from "./StepShell";

/** Étape 3 — "Connect your code" (GitHub / GitLab, indexation simulée). */
export function StepConnectCode() {
  const { state } = useOnboarding();
  const { submit, pending, error } = useStepSubmit();
  const integrations = useIntegrations();
  const connected = state.integrations.some((i) => CODE_PROVIDERS.includes(i.provider));
  const slug = state.organisation.slug || "acme";

  return (
    <StepShell step={3}>
      <div className="grid gap-3">
        {CODE_PROVIDERS.map((provider) => (
          <IntegrationConnectCard
            key={provider}
            provider={provider}
            integration={integrations.get(provider)}
            busy={integrations.busy === provider}
            defaultDetail={`${slug}/app`}
            onConnect={(detail) => integrations.connect(provider, detail)}
            onDisconnect={() => integrations.disconnect(provider)}
          />
        ))}
      </div>
      {integrations.error && <p className="mt-3 text-xs text-red-600">{integrations.error}</p>}

      <StepFooter
        step={3}
        pending={pending}
        error={error}
        continueLabel={connected ? "Continue" : "Skip for now"}
        onContinue={() => submit({ step: 3 })}
      />
    </StepShell>
  );
}
