"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch, errorMessage } from "@/lib/api";
import { DEV_CODE_KEY } from "./AuthForm";

/** "Check your e-mail" step, with a local inbox preview (no outbound e-mail in this prototype). */
export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setDevCode(sessionStorage.getItem(DEV_CODE_KEY));
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await apiFetch<{ next: string }>("/api/auth/verify", { method: "POST", json: { code } });
      sessionStorage.removeItem(DEV_CODE_KEY);
      router.push(res.next);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const res = await apiFetch<{ devCode?: string }>("/api/auth/resend", { method: "POST" });
      if (res.devCode) {
        sessionStorage.setItem(DEV_CODE_KEY, res.devCode);
        setDevCode(res.devCode);
      }
      setInfo("A new code is on its way.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-white p-8 shadow-xl shadow-brand-900/5">
        <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 6h16v12H4zM4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Verify your e-mail</h1>
        <p className="mt-1.5 text-sm text-muted">
          We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>.
        </p>
        <form onSubmit={verify} className="mt-6 space-y-4" noValidate>
          <Input
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="[&_input]:font-mono [&_input]:tracking-[0.4em]"
          />
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {info && !error && <p className="text-sm text-emerald-700">{info}</p>}
          <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Verifying…" disabled={code.length !== 6}>
            Verify e-mail
          </Button>
        </form>
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="mt-4 w-full text-center text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>

      {devCode && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Local inbox (no e-mail is sent)</p>
          <p className="mt-2 text-slate-700">
            Your QASyn verification code: <span className="font-mono text-base font-semibold text-ink">{devCode}</span>
          </p>
          <button type="button" onClick={() => setCode(devCode)} className="mt-2 text-xs font-semibold text-brand-700 hover:underline">
            Use this code →
          </button>
        </div>
      )}
    </div>
  );
}
