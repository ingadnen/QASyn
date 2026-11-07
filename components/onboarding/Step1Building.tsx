"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { apiFetch, errorMessage } from "@/lib/api";
import { APP_DESCRIPTION_MAX, OS_OPTIONS } from "@/lib/constants";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { buildTunnelCommand } from "@/lib/tunnel";
import type { AppLoginType, OsKey, ReachMode } from "@/lib/types";
import { cn, normalizeWebsite } from "@/lib/utils";
import { useSaveStep } from "./hooks";
import { StepFooter, StepHeader } from "./StepChrome";

function RadioCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
        active ? "border-brand-500 bg-brand-50/60 ring-4 ring-brand-100" : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", active ? "border-brand-600" : "border-slate-300")}>
        {active && <span className="size-2 rounded-full bg-brand-600" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
    </button>
  );
}

const LOGIN_OPTIONS: Array<{ value: AppLoginType; label: string; description: string }> = [
  { value: "none", label: "No login needed", description: "The app is public, or the pages to test don't require an account." },
  { value: "signup_test_account", label: "Sign up a new test account for me", description: "QASyn creates a dedicated test user through your sign-up flow." },
  { value: "credentials", label: "I'll provide login credentials", description: "Use an existing test account (never a real customer's)." },
];

export function Step1Building() {
  const { state, patch } = useOnboarding();
  const { save, pending, error } = useSaveStep();

  const [os, setOs] = useState<OsKey>("MACOS");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tunnelBusy, setTunnelBusy] = useState<"rotate" | "enroll" | null>(null);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);

  const reachMode = state.reachMode;
  const normalizedUrl = normalizeWebsite(state.environmentUrl);

  async function tunnel(action: "rotate" | "enroll") {
    setTunnelBusy(action);
    setTunnelError(null);
    try {
      const res = await apiFetch<{ tunnelToken: string | null; tunnelEnrolled: boolean; localPort: number }>("/api/onboarding/tunnel", {
        method: "POST",
        json: { action, localPort: state.localPort },
      });
      patch({ tunnelToken: res.tunnelToken, tunnelEnrolled: res.tunnelEnrolled, localPort: res.localPort });
    } catch (e) {
      setTunnelError(errorMessage(e));
    } finally {
      setTunnelBusy(null);
    }
  }

  // Issue a token the first time "Localhost" is selected.
  useEffect(() => {
    if (reachMode === "localhost" && !state.tunnelToken && tunnelBusy === null) void tunnel("rotate");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reachMode, state.tunnelToken]);

  function selectReach(mode: ReachMode) {
    setCheck(null);
    patch({ reachMode: mode });
  }

  async function checkConnection() {
    setChecking(true);
    setCheck(null);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>("/api/onboarding/connection", {
        method: "POST",
        json: reachMode === "localhost" ? { reachMode, localPort: state.localPort } : { reachMode: "staging", environmentUrl: state.environmentUrl },
      });
      setCheck(res);
    } catch (e) {
      setCheck({ ok: false, message: errorMessage(e) });
    } finally {
      setChecking(false);
    }
  }

  const reachReady = reachMode === "staging" ? normalizedUrl !== null : reachMode === "localhost" ? state.tunnelEnrolled : false;
  const loginReady =
    state.appLoginType !== null && (state.appLoginType !== "credentials" || state.appLoginUsername.trim().length > 0);
  const canContinue = state.appDescription.trim().length > 0 && reachReady && loginReady;

  function submit() {
    if (!reachMode || !state.appLoginType) return;
    void save({
      step: 1,
      appDescription: state.appDescription,
      reachMode,
      environmentUrl: reachMode === "staging" ? state.environmentUrl : undefined,
      localPort: reachMode === "localhost" ? state.localPort : undefined,
      appLoginType: state.appLoginType,
      appLoginUsername: state.appLoginType === "credentials" ? state.appLoginUsername : undefined,
      appLoginPassword: state.appLoginType === "credentials" && password ? password : undefined,
    });
  }

  const token = state.tunnelToken ?? "tnl_generating…";

  return (
    <div className="space-y-8">
      <StepHeader
        step={1}
        title="What are you building?"
        subtitle="Tell QASyn about your product, where it runs and how to sign in. It starts mapping your app right away."
      />

      <Textarea
        label="Describe your app"
        placeholder="e.g. A B2B invoicing platform. Users sign up, connect their bank, create invoices and get paid by card…"
        maxLength={APP_DESCRIPTION_MAX}
        value={state.appDescription}
        onChange={(e) => patch({ appDescription: e.target.value })}
        hint="The more context, the better the first test cases."
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">Where can QASyn reach your app?</legend>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          <RadioCard
            active={reachMode === "staging"}
            onClick={() => selectReach("staging")}
            title="Your team's environment"
            description="A staging, preview or QA URL reachable from the internet."
          />
          <RadioCard
            active={reachMode === "localhost"}
            onClick={() => selectReach("localhost")}
            title="Localhost, right now"
            description="Open a secure tunnel to the app running on your machine."
          />
        </div>

        {reachMode === "staging" && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <Input
              label="App endpoint *"
              type="url"
              inputMode="url"
              placeholder="https://staging.yourcompany.com"
              value={state.environmentUrl}
              onChange={(e) => {
                setCheck(null);
                patch({ environmentUrl: e.target.value });
              }}
              error={state.environmentUrl && !normalizedUrl ? "Enter a valid URL, e.g. https://staging.example.com" : null}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={checkConnection} loading={checking} loadingText="Checking…" disabled={!normalizedUrl}>
                Check connection
              </Button>
              {check && <span className={cn("text-xs font-medium", check.ok ? "text-emerald-600" : "text-red-600")}>{check.ok ? "✓ " : ""}{check.message}</span>}
            </div>
          </div>
        )}

        {reachMode === "localhost" && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs label="Operating system" value={os} onChange={setOs} options={OS_OPTIONS} />
              <label className="flex items-center gap-2 text-xs text-slate-600">
                Port
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={state.localPort}
                  onChange={(e) => patch({ localPort: Math.min(65535, Math.max(1, Number(e.target.value) || 3000)) })}
                  className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 text-sm"
                />
              </label>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-slate-500">1 · COMMAND</p>
              <CodeBlock title={OS_OPTIONS.find((o) => o.value === os)?.label} code={buildTunnelCommand(os, token, state.localPort)} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">2 · INSTALL TOKEN</p>
                <button
                  type="button"
                  onClick={() => tunnel("rotate")}
                  disabled={tunnelBusy !== null}
                  className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                >
                  Rotate
                </button>
              </div>
              <CodeBlock title="token" code={`# install token\n${token}`} copyText={state.tunnelToken ?? ""} />
            </div>
            <div className="space-y-1.5 rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200">
              <StatusLine done={state.tunnelEnrolled} pendingText="Waiting for qa to enroll" doneText="qa agent enrolled" />
              <StatusLine
                done={state.tunnelEnrolled}
                pendingText="Waiting for a route"
                doneText={`Route open → localhost:${state.localPort}`}
              />
            </div>
            {!state.tunnelEnrolled ? (
              <Button variant="secondary" size="sm" onClick={() => tunnel("enroll")} loading={tunnelBusy === "enroll"} loadingText="Enrolling…" disabled={!state.tunnelToken}>
                I ran the command — simulate enrolment
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={checkConnection} loading={checking} loadingText="Checking…">
                Check connection
              </Button>
            )}
            {check && <p className={cn("text-xs font-medium", check.ok ? "text-emerald-600" : "text-red-600")}>{check.message}</p>}
            {tunnelError && <p className="text-xs text-red-600">{tunnelError}</p>}
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">Does your app need a login?</legend>
        <div role="radiogroup" className="space-y-2">
          {LOGIN_OPTIONS.map((option) => (
            <RadioCard
              key={option.value}
              active={state.appLoginType === option.value}
              onClick={() => patch({ appLoginType: option.value })}
              title={option.label}
              description={option.description}
            />
          ))}
        </div>

        {state.appLoginType === "credentials" && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <Input
              label="Username or e-mail *"
              autoComplete="off"
              placeholder="qa-bot@yourcompany.com"
              value={state.appLoginUsername}
              onChange={(e) => patch({ appLoginUsername: e.target.value })}
            />
            <Input
              label="Password (optional)"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={state.hasAppLoginPassword ? "•••••••• (saved — leave empty to keep)" : "Test account password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPassword && <path d="M4 4l16 16" strokeLinecap="round" />}
                  </svg>
                </button>
              }
              hint="Encrypted at rest (AES-256-GCM) and never shown again."
            />
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900">
              <p className="font-semibold">Before you continue</p>
              <p className="mt-1">Use a dedicated test account with the least privileges needed. Turn off MFA/CAPTCHA for it, or tell us how to bypass them in staging.</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900">
              <p className="font-semibold">Network requirements</p>
              <p className="mt-1">If your environment is behind a firewall or VPN, allow-list QASyn&apos;s runners or use the localhost tunnel instead.</p>
            </div>
          </div>
        )}
      </fieldset>

      <StepFooter step={1} onContinue={submit} canContinue={canContinue} pending={pending} error={error} />
    </div>
  );
}

function StatusLine({ done, pendingText, doneText }: { done: boolean; pendingText: string; doneText: string }) {
  return (
    <p className="flex items-center gap-2">
      {done ? (
        <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">✓</span>
      ) : (
        <span className="relative flex size-4 items-center justify-center">
          <span className="absolute size-3 animate-ping rounded-full bg-amber-400/60" />
          <span className="size-2 rounded-full bg-amber-500" />
        </span>
      )}
      <span className={done ? "text-slate-800" : "text-slate-500"}>{done ? doneText : pendingText}</span>
    </p>
  );
}
