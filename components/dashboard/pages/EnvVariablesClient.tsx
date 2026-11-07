"use client";

import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

/** Global vs environment variables with secret masking and substitution hints. */
export function EnvVariablesForm({ environmentId, readOnly }: { environmentId: string; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run("v", "/api/dashboard/env-variables", { json: { environmentId, key, value, isSecret } });
        setKey("");
        setValue("");
      }}
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Key (e.g. BASE_URL)</span>
        <input className={cn(inputCls, "mt-1")} value={key} disabled={readOnly} onChange={(e) => setKey(e.target.value)} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Value</span>
        <input className={cn(inputCls, "mt-1")} value={value} disabled={readOnly} onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={isSecret} disabled={readOnly} onChange={(e) => setIsSecret(e.target.checked)} /> secret
        </label>
        <Button type="submit" size="sm" loading={pending === "v"} disabled={readOnly}>Save</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{error}</p>}
      <p className="text-xs text-slate-400 sm:col-span-3">Use <code>{"{{env.KEY}}"}</code> in steps/requests; secrets are masked in logs.</p>
    </form>
  );
}
