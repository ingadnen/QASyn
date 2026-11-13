"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch, errorMessage } from "@/lib/api";

/** "Check your e-mail" step. The raw code is never rendered by default. */
export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await apiFetch<{ next: string }>("/api/auth/verify", { method: "POST", json: { code } });
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
      await apiFetch("/api/auth/resend", { method: "POST" });
      setInfo("A new code is on its way. Check your inbox and spam folder.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setResending(false);
    }
  }

  async function instantVerify() {
    setResending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/otp-preview", { headers: { "x-qasyn-otp-preview": "1" }, cache: "no-store" });
      if (!response.ok) throw new Error("Instant verification is not available for this account. Use the e-mail code.");
      const data = (await response.json()) as { code?: string };
      if (!data.code) throw new Error("No verification code is available yet. Resend the code first.");
      const result = await apiFetch<{ next: string }>("/api/auth/verify", { method: "POST", json: { code: data.code } });
      router.push(result.next);
      router.refresh();
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
          We sent a 6-digit verification code to <span className="font-medium text-ink">{email}</span>. Please check your inbox (and spam folder).
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
          {resending ? "Sending…" : "Resend verification code"}
        </button>
        <details className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
          <summary className="cursor-pointer select-none font-medium text-slate-600">Can&apos;t receive email in this environment?</summary>
          <button type="button" onClick={() => void instantVerify()} disabled={resending} className="mt-2 font-semibold text-brand-600 hover:underline disabled:opacity-50">
            Request instant verification
          </button>
        </details>
      </div>
    </div>
  );
}
