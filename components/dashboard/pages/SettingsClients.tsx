"use client";

import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100";

export function SettingsSimpleForm({ kind, readOnly }: { kind: "webhook" | "notification"; readOnly: boolean }) {
  const { run, pending, error } = useAction();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [channel, setChannel] = useState<"slack" | "teams" | "email">("slack");
  const [events, setEvents] = useState("test.failed");

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "webhook") {
      await run("w", "/api/dashboard/webhooks", { json: { name, url, events: events.split(",").map((x) => x.trim()).filter(Boolean) } });
    } else {
      await run("n", "/api/dashboard/notification-rules", { json: { channel, events: events.split(",").map((x) => x.trim()).filter(Boolean) } });
    }
  }

  return (
    <form onSubmit={(e) => void go(e)} className="grid gap-3 sm:grid-cols-2">
      {kind === "webhook" ? (
        <>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Name</span>
            <input className={cn(inputCls, "mt-1")} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">URL</span>
            <input className={cn(inputCls, "mt-1")} value={url} disabled={readOnly} onChange={(e) => setUrl(e.target.value)} placeholder="https://ci.example.com/hook" />
          </label>
        </>
      ) : (
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Channel</span>
          <select className={cn(inputCls, "mt-1")} value={channel} disabled={readOnly} onChange={(e) => setChannel(e.target.value as typeof channel)}>
            <option value="slack">Slack</option>
            <option value="teams">MS Teams</option>
            <option value="email">Email</option>
          </select>
        </label>
      )}
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Events (comma separated)</span>
        <input className={cn(inputCls, "mt-1")} value={events} disabled={readOnly} onChange={(e) => setEvents(e.target.value)} />
      </label>
      <div className="flex items-end sm:col-span-2"><Button type="submit" loading={pending === "w" || pending === "n"} disabled={readOnly}>Create</Button></div>
      {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
    </form>
  );
}
