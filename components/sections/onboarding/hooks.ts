"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import type { OnboardingState, Provider } from "@/lib/types";
import type { StepPayload } from "@/lib/validation";

/** "Continue" : PATCH /api/onboarding → met à jour le contexte → étape suivante. */
export function useStepSubmit() {
  const router = useRouter();
  const { replace } = useOnboarding();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (payload: StepPayload) => {
      setPending(true);
      setError(null);
      try {
        const res = await apiFetch<{ state: OnboardingState; next: string }>("/api/onboarding", {
          method: "PATCH",
          json: payload,
        });
        replace(res.state);
        router.push(res.next);
      } catch (e) {
        setError(errorMessage(e));
        setPending(false);
      }
    },
    [replace, router],
  );

  return { submit, pending, error };
}

const POLL_MS = 2500;

/** Connexion / déconnexion des intégrations + polling pendant l'indexation. */
export function useIntegrations() {
  const { state, replace } = useOnboarding();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const indexing = state.integrations.some((i) => i.status === "INDEXING");

  useEffect(() => {
    if (!indexing) return;
    const timer = setInterval(async () => {
      try {
        const res = await apiFetch<{ state: OnboardingState }>("/api/onboarding");
        replace(res.state);
      } catch {
        /* le prochain tick réessaiera */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [indexing, replace]);

  const run = useCallback(
    async (provider: Provider, method: "POST" | "DELETE", detail?: string) => {
      setBusy(provider);
      setError(null);
      try {
        const res = await apiFetch<{ state: OnboardingState }>(
          `/api/onboarding/integrations/${provider.toLowerCase()}`,
          { method, json: method === "POST" ? { detail } : undefined },
        );
        replace(res.state);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(null);
      }
    },
    [replace],
  );

  return {
    integrations: state.integrations,
    get: (provider: Provider) => state.integrations.find((i) => i.provider === provider),
    connect: (provider: Provider, detail?: string) => run(provider, "POST", detail),
    disconnect: (provider: Provider) => run(provider, "DELETE"),
    busy,
    error,
  };
}
