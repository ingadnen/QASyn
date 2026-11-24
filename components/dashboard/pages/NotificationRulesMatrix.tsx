"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface RuleRow {
  id: string;
  channel: string;
  events: string[];
  enabled: boolean;
}

interface NotificationRule {
  id: string;
  channel: string;
  events: string;
  enabled: boolean;
}

export const SYNC_EVENT_TYPES: Array<{ value: string; label: string; providers: string }> = [
  { value: "pr.opened_or_updated", label: "PR opened / updated", providers: "GitHub · GitLab · Azure DevOps" },
  { value: "docs.confluence_updated", label: "Confluence docs updated", providers: "Confluence · Requirements" },
  { value: "jira.issue_synced", label: "Jira issue synced", providers: "Jira" },
  { value: "test_run.failed_or_regression", label: "Test run failed / regression", providers: "Test Runs" },
  { value: "self_heal.applied", label: "Self-heal applied", providers: "Web Testing" },
  { value: "autopilot.completed", label: "Autopilot completed", providers: "Ship Workflows" },
  { value: "billing.low_credits", label: "Low credits", providers: "Billing" },
];

function parseEvents(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function NotificationRulesMatrix({ rules, readOnly }: { rules: NotificationRule[]; readOnly: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function toggle(ruleId: string, enabled: boolean) {
    setBusyKey(ruleId);
    try {
      await fetch("/api/dashboard/notification-rules", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ruleId, enabled }),
      });
      startTransition(() => router.refresh());
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleEvent(ruleId: string, rule: RuleRow, eventType: string) {
    const events = rule.events.includes(eventType)
      ? rule.events.filter((event) => event !== eventType)
      : [...rule.events, eventType];
    setBusyKey(`${ruleId}:${eventType}`);
    try {
      await fetch("/api/dashboard/notification-rules", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: ruleId, events }),
      });
      startTransition(() => router.refresh());
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="overflow-x-auto" data-testid="notification-rules-matrix">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3 font-medium">Event type</th>
            <th className="py-2 pr-3 font-medium">Sources</th>
            {rules.map((rule) => (
              <th key={rule.id} className="py-2 pr-3 text-center font-medium capitalize">
                {rule.channel}
                <button
                  type="button"
                  disabled={readOnly || pending}
                  onClick={() => void toggle(rule.id, !rule.enabled)}
                  className={cn(
                    "mt-1 block w-full rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    rule.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400",
                    (readOnly || pending) && "cursor-not-allowed",
                  )}
                >
                  {rule.enabled ? "On" : "Off"}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SYNC_EVENT_TYPES.map((eventType) => (
            <tr key={eventType.value} className="border-b border-slate-100">
              <td className="py-2.5 pr-3">
                <p className="font-medium text-slate-800">{eventType.label}</p>
                <p className="font-mono text-[10px] text-slate-400">{eventType.value}</p>
              </td>
              <td className="py-2.5 pr-3 text-xs text-slate-500">{eventType.providers}</td>
              {rules.map((rule) => {
                const events = parseEvents(rule.events);
                const checked = events.includes(eventType.value);
                return (
                  <td key={rule.id} className="py-2.5 pr-3 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${eventType.label} via ${rule.channel}`}
                      checked={checked}
                      disabled={readOnly || !rule.enabled || pending}
                      onChange={() => void toggleEvent(rule.id, { id: rule.id, channel: rule.channel, events, enabled: rule.enabled }, eventType.value)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400 disabled:opacity-40"
                    />
                    {busyKey === `${rule.id}:${eventType.value}` && <span className="ml-1 text-[10px] text-slate-300">…</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
