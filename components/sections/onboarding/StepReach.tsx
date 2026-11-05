"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch, errorMessage } from "@/lib/api";
import { REACH_OPTIONS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import type { OsKey, ReachType } from "@/lib/types";
import { cn, normalizeWebsite } from "@/lib/utils";
import { useStepSubmit } from "./hooks";
import { LocalhostInstaller } from "./LocalhostInstaller";
import { StepFooter, StepShell } from "./StepShell";

interface CheckResult {
  ok: boolean;
  target: string;
  latencyMs: number;
  message: string;
}

function detectOs(): OsKey {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "WINDOWS";
  if (/Mac OS|Macintosh/i.test(ua)) return "MACOS";
  return "LINUX";
}

/** Étape 2 — "Where can QASyn reach it?" */
export function StepReach() {
  const { state, patch } = useOnboarding();
  const { submit, pending, error } = useStepSubmit();

  const reachType = state.reachType;
  const environmentUrl = state.environmentUrl || state.organisation.website;
  const os = state.selectedOs ?? "WINDOWS";

  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{ key: string; result: CheckResult } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const tokenRequested = useRef(false);

  // Clé de la cible actuelle : un changement invalide la vérification précédente
  const checkKey = reachType === "LOCALHOST" ? `L:${state.localPort}` : `T:${normalizeWebsite(environmentUrl) ?? ""}`;
  const verified = check?.key === checkKey && check.result.ok;

  // Détection de l'OS (côté client uniquement)
  useEffect(() => {
    if (!state.selectedOs) patch({ selectedOs: detectOs() });
  }, [state.selectedOs, patch]);

  // Jeton du tunnel : généré à la première sélection de "Localhost"
  useEffect(() => {
    if (reachType !== "LOCALHOST" || state.tunnelToken || tokenRequested.current) return;
    tokenRequested.current = true;
    apiFetch<{ token: string }>("/api/onboarding/tunnel-token", { method: "POST" })
      .then((res) => patch({ tunnelToken: res.token }))
      .catch((e) => setCheckError(errorMessage(e)));
  }, [reachType, state.tunnelToken, patch]);

  async function rotateToken() {
    setRotating(true);
    try {
      const res = await apiFetch<{ token: string }>("/api/onboarding/tunnel-token?rotate=1", { method: "POST" });
      patch({ tunnelToken: res.token });
      setCheck(null);
    } catch (e) {
      setCheckError(errorMessage(e));
    } finally {
      setRotating(false);
    }
  }

  async function checkConnection() {
    setChecking(true);
    setCheckError(null);
    try {
      const result = await apiFetch<CheckResult>("/api/onboarding/connection", {
        method: "POST",
        json:
          reachType === "LOCALHOST"
            ? { reachType, localPort: state.localPort }
            : { reachType: "TEAM_ENV", environmentUrl },
      });
      setCheck({ key: checkKey, result });
    } catch (e) {
      setCheck(null);
      setCheckError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  function onContinue() {
    if (reachType === "LOCALHOST") {
      submit({ step: 2, reachType, selectedOs: os, localPort: state.localPort });
    } else if (reachType === "TEAM_ENV") {
      submit({ step: 2, reachType, environmentUrl });
    }
  }

  return (
    <StepShell step={2}>
      <div role="radiogroup" aria-label="Environment type" className="grid gap-3 sm:grid-cols-2">
        {REACH_OPTIONS.map((option) => (
          <ReachCard
            key={option.key}
            selected={reachType === option.key}
            onSelect={() => patch({ reachType: option.key as ReachType })}
            label={option.label}
            description={option.description}
            tag={option.key === "TEAM_ENV" ? "Staging / QA" : "Secure tunnel"}
          />
        ))}
      </div>

      {reachType === "TEAM_ENV" && (
        <div className="mt-6 animate-fade-in">
          <Input
            label="Environment URL"
            type="url"
            inputMode="url"
            placeholder="https://staging.example.com"
            value={environmentUrl}
            onChange={(e) => patch({ environmentUrl: e.target.value })}
            hint="Ship never tests production unless you ask it to."
          />
        </div>
      )}

      {reachType === "LOCALHOST" && (
        <div className="mt-6 animate-fade-in">
          <LocalhostInstaller
            os={os}
            onOsChange={(value) => patch({ selectedOs: value })}
            port={state.localPort}
            onPortChange={(value) => patch({ localPort: value })}
            token={state.tunnelToken}
            onRotate={rotateToken}
            rotating={rotating}
          />
        </div>
      )}

      {reachType && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={checkConnection}
            loading={checking}
            loadingText="Checking connection…"
            disabled={reachType === "TEAM_ENV" && !normalizeWebsite(environmentUrl)}
          >
            Check connection
          </Button>
          {verified && check && (
            <Badge tone="success" dot>
              {check.result.message} · {check.result.latencyMs} ms
            </Badge>
          )}
          {checkError && <span className="text-xs text-red-600">{checkError}</span>}
        </div>
      )}

      <StepFooter
        step={2}
        pending={pending}
        error={error}
        disabled={!reachType || !verified}
        onContinue={onContinue}
      />
    </StepShell>
  );
}

function ReachCard({
  selected,
  onSelect,
  label,
  description,
  tag,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description: string;
  tag: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        selected
          ? "border-brand-500 bg-brand-50/60 shadow-sm ring-4 ring-brand-100"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
      )}
    >
      <span className="flex w-full items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">{label}</span>
        <span
          className={cn(
            "flex size-4 items-center justify-center rounded-full border",
            selected ? "border-brand-600 bg-brand-600" : "border-slate-300",
          )}
        >
          {selected && <span className="size-1.5 rounded-full bg-white" />}
        </span>
      </span>
      <span className="mt-1 text-xs text-slate-500">{description}</span>
      <span className="mt-3 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{tag}</span>
    </button>
  );
}
