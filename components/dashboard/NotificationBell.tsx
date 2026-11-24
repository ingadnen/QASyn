"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FeedNotification {
  id: string;
  eventType: string;
  provider: string | null;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

const EVENT_FILTERS = [
  { value: "", label: "All" },
  { value: "pr.opened_or_updated", label: "PRs" },
  { value: "docs.confluence_updated", label: "Docs" },
  { value: "jira.issue_synced", label: "Jira" },
  { value: "test_run.failed_or_regression", label: "Failures" },
  { value: "self_heal.applied", label: "Self-heal" },
  { value: "autopilot.completed", label: "Autopilot" },
  { value: "billing.low_credits", label: "Billing" },
];

export function NotificationBell({ readOnly }: { readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (filterValue: string) => {
    const params = new URLSearchParams();
    if (filterValue) params.set("eventType", filterValue);
    try {
      const response = await fetch(`/api/dashboard/notifications?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { notifications: FeedNotification[]; unread: number };
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {
      // Polling failure: keep the last known state.
    }
  }, []);

  useEffect(() => {
    void load(filter);
    const timer = setInterval(() => void load(filter), 2000);
    return () => clearInterval(timer);
  }, [filter, load]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAll() {
    await fetch("/api/dashboard/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark-all-read" }),
    });
    void load(filter);
  }

  async function openItem(notification: FeedNotification) {
    if (!notification.readAt && !readOnly) {
      await fetch("/api/dashboard/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark-read", id: notification.id }),
      }).catch(() => undefined);
    }
    setOpen(false);
    void load(filter);
    if (notification.linkUrl) window.open(notification.linkUrl, "_blank", "noopener");
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        data-testid="topbar-notifications-bell"
        aria-label={`Notifications (${unread} unread)`}
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span data-testid="notifications-unread-count" className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            <button type="button" onClick={() => void markAll()} disabled={readOnly || unread === 0} className="text-xs font-medium text-brand-600 hover:underline disabled:text-slate-300">
              Mark all read
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2">
            {EVENT_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium",
                  filter === option.value ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {notifications.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">Nothing here yet.</li>}
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button type="button" onClick={() => void openItem(notification)} className={cn("block w-full px-4 py-3 text-left hover:bg-slate-50", !notification.readAt && "bg-brand-50/40")}>
                  <p className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{notification.eventType}</span>
                    {!notification.readAt && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                    <span className="ml-auto">{new Date(notification.createdAt).toLocaleTimeString()}</span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{notification.title}</p>
                  <p className="text-xs text-slate-500">{notification.body}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
