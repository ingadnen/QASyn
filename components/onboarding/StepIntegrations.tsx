"use client";

import type { Provider } from "@/lib/types";
import { useIntegrations, useSaveStep } from "./hooks";
import { IntegrationRow } from "./IntegrationRow";
import { StepFooter, StepHeader } from "./StepChrome";

function ProviderGroup({ title, providers }: { title: string; providers: Provider[] }) {
  const { integrations, connect, disconnect, busy, error } = useIntegrations();
  return (
    <section>
      <h2 className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">{title}</h2>
      <div className="mt-2 space-y-2">
        {providers.map((p) => (
          <IntegrationRow
            key={p}
            provider={p}
            integration={integrations.find((i) => i.provider === p)}
            busy={busy === p}
            disabled={busy !== null && busy !== p}
            onConnect={() => connect(p)}
            onDisconnect={() => disconnect(p)}
          />
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

export function Step3Code() {
  const { save, pending, error } = useSaveStep();
  const { integrations } = useIntegrations();
  const connected = integrations.some((i) => i.provider === "GITHUB" || i.provider === "GITLAB");
  return (
    <div className="space-y-8">
      <StepHeader
        step={3}
        title="Connect your code"
        subtitle="QASyn reads pull requests to work out what changed and which flows to re-test. Read-only access, simulated in this prototype."
      />
      <ProviderGroup title="SOURCE CONTROL" providers={["GITHUB", "GITLAB"]} />
      <StepFooter
        step={3}
        pending={pending}
        error={error}
        canContinue={connected}
        onSkip={() => save({ step: 3, skip: true }, "skip")}
        onContinue={() => save({ step: 3 })}
      />
    </div>
  );
}

export function Step4Tools() {
  const { save, pending, error } = useSaveStep();
  return (
    <div className="space-y-8">
      <StepHeader
        step={4}
        title="Connect your team's tools"
        subtitle="Incoming bugs get reproduced automatically, and results land where your team already works."
      />
      <ProviderGroup title="ISSUE TRACKING" providers={["JIRA", "LINEAR"]} />
      <ProviderGroup title="COMMUNICATION" providers={["SLACK"]} />
      <StepFooter step={4} pending={pending} error={error} onSkip={() => save({ step: 4, skip: true }, "skip")} onContinue={() => save({ step: 4 })} />
    </div>
  );
}
