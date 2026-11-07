"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch, errorMessage } from "@/lib/api";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/constants";

const DEV_CODE_KEY = "qasyn.devCode";

/** Login / signup form (shared). Stores the simulated verification code for the local inbox preview. */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await apiFetch<{ next: string; devCode?: string }>(`/api/auth/${mode}`, {
        method: "POST",
        json: { email, password },
      });
      if (res.devCode) sessionStorage.setItem(DEV_CODE_KEY, res.devCode);
      router.push(res.next);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-white p-8 shadow-xl shadow-brand-900/5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1.5 text-sm text-muted">
          {isLogin ? "Log in to your QASyn workspace." : "Start a 15-day free trial. No credit card required."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Input
            label="Work e-mail"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder={isLogin ? "Your password" : "At least 10 characters, with a number"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            }
            required
          />
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth loading={pending} loadingText={isLogin ? "Logging in…" : "Creating account…"}>
            {isLogin ? "Log in" : "Sign up"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {isLogin ? (
            <>
              New to QASyn?{" "}
              <Link href="/signup" className="font-medium text-brand-600 hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-brand-600 hover:underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </div>

      {isLogin && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-5 text-sm">
          <p className="font-semibold text-brand-800">Demo workspace · Acme (mock data)</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[13px] text-brand-900">
            <dt className="text-brand-600">Email</dt>
            <dd>{DEMO_EMAIL}</dd>
            <dt className="text-brand-600">Password</dt>
            <dd>{DEMO_PASSWORD}</dd>
          </dl>
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_EMAIL);
              setPassword(DEMO_PASSWORD);
            }}
            className="mt-3 text-xs font-semibold text-brand-700 hover:underline"
          >
            Fill demo credentials →
          </button>
        </div>
      )}
    </div>
  );
}

export { DEV_CODE_KEY };
