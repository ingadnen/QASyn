"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

/** Creates an auth profile variable (bearer/basic/proxy/viewport) persisted as an EnvironmentVariable. */
export function AuthProfileForm({ readOnly, environmentId }: { readOnly: boolean; environmentId: string }) {
  const { run, pending, error } = useAction();
  const router = useRouter();
  const [kind, setKind] = useState<"bearer" | "basic" | "proxy" | "viewport">("bearer");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!environmentId) return;
    const res = await run("ap", "/api/dashboard/env-variables", {
      json: { environmentId, key: `AUTH_${kind.toUpperCase()}_${name.trim().toUpperCase().replace(/\s+/g, "_") || "DEFAULT"}`, value, isSecret: true },
    });
    if (res) router.refresh();
  }

  return (
    <form onSubmit={(e) => void go(e)} className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Profile kind</span>
        <select className={cn(inputCls, "mt-1")} value={kind} disabled={readOnly} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic auth</option>
          <option value="proxy">Proxy</option>
          <option value="viewport">Viewport</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Name</span>
        <input className={cn(inputCls, "mt-1")} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} placeholder="qa-bot" />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Secret value (masked)</span>
        <input className={cn(inputCls, "mt-1")} value={value} disabled={readOnly} onChange={(e) => setValue(e.target.value)} placeholder="••••••••" />
      </label>
      <Button type="submit" loading={pending === "ap"} disabled={readOnly || !environmentId}>Create profile</Button>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-4">{error}</p>}
    </form>
  );
}
