"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import type { IntegrationDTO, OnboardingState, Provider } from "@/lib/types";

const POLL_MS = 2500;

/** Saves one onboarding step (PATCH /api/onboarding) then navigates to the next one. */
export function useSaveStep() {
  const router = useRouter();
  const { replace } = useOnboarding();
  const [pending, setPending] = useState<"continue" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (payload: Record<string, unknown> & { step: number }, kind: "continue" | "skip" = "continue", nextOverride?: string) => {
      setPending(kind);
      setError(null);
      try {
        const res = await apiFetch<{ state: OnboardingState; next: string }>("/api/onboarding", { method: "PATCH", json: payload });
        replace(res.state);
        router.push(nextOverride ?? res.next);
        router.refresh();
      } catch (e) {
        setError(errorMessage(e));
        setPending(null);
      }
    },
    [replace, router],
  );

  return { save, pending, error, setError };
}

/** Connect / disconnect a provider and poll while code hosts are INDEXING. */
export function useIntegrations() {
  const { state, patch } = useOnboarding();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const indexing = state.integrations.some((i) => i.status === "INDEXING");

  useEffect(() => {
    if (!indexing) return;
    const timer = setInterval(async () => {
      try {
        const res = await apiFetch<{ state: OnboardingState }>("/api/onboarding");
        patch({ integrations: res.state.integrations });
      } catch {
        // keep polling
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [indexing, patch]);

  const connect = useCallback(
    async (provider: Provider, detail?: string) => {
      setBusy(provider);
      setError(null);
      try {
        const res = await apiFetch<{ integration: IntegrationDTO }>(`/api/onboarding/integrations/${provider.toLowerCase()}`, {
          method: "POST",
          json: detail ? { detail } : {},
        });
        patch({ integrations: [...state.integrations.filter((i) => i.provider !== provider), res.integration] });
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(null);
      }
    },
    [patch, state.integrations],
  );

  const disconnect = useCallback(
    async (provider: Provider) => {
      setBusy(provider);
      setError(null);
      try {
        await apiFetch(`/api/onboarding/integrations/${provider.toLowerCase()}`, { method: "DELETE" });
        patch({ integrations: state.integrations.filter((i) => i.provider !== provider) });
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(null);
      }
    },
    [patch, state.integrations],
  );

  return { integrations: state.integrations, connect, disconnect, busy, error };
}
