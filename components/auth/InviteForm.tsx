"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch, errorMessage } from "@/lib/api";

export function InviteForm({ token, email, organisationName, role }: { token: string; email: string; organisationName: string; role: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await apiFetch<{ next: string }>(`/api/invites/${token}`, { method: "POST", json: { name, password } });
      router.push(result.next);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm">
        You&apos;re joining <strong>{organisationName}</strong> as <strong>{role}</strong> · <span className="font-mono">{email}</span>
      </div>
      <Input label="Full name" autoComplete="name" placeholder="Jane Cooper" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 10 characters, with a number"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Joining workspace…">
        Accept invitation &amp; join {organisationName}
      </Button>
    </form>
  );
}
