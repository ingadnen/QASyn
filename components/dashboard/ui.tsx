"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Calls an API route then refreshes the server components of the page. */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(key: string, url: string, init: { method?: "POST" | "PATCH" | "DELETE"; json?: unknown } = {}): Promise<T | null> => {
      setPending(key);
      setError(null);
      try {
        const res = await apiFetch<T>(url, { method: init.method ?? "POST", json: init.json });
        router.refresh();
        return res;
      } catch (e) {
        setError(errorMessage(e));
        return null;
      } finally {
        setPending(null);
      }
    },
    [router],
  );

  return { run, pending, error, setError };
}

export function PageHeader({
  title,
  description,
  actions,
  kicker,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  kicker?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker && <p className="text-[11px] font-semibold tracking-[0.16em] text-brand-600">{kicker}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, title, actions }: { className?: string; children: React.ReactNode; title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
        ∅
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  );
}

const PILL: Record<string, string> = {
  passing: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  passed_baseline: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  covered: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  indexed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  fixed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CONNECTED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  low: "bg-slate-100 text-slate-600 ring-slate-500/10",
  failing: "bg-red-50 text-red-700 ring-red-600/20",
  regression_caught: "bg-red-50 text-red-700 ring-red-600/20",
  critical: "bg-red-50 text-red-700 ring-red-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
  FAILED: "bg-red-50 text-red-700 ring-red-600/20",
  uncovered: "bg-red-50 text-red-700 ring-red-600/20",
  high: "bg-orange-50 text-orange-700 ring-orange-600/20",
  flaky: "bg-amber-50 text-amber-700 ring-amber-600/20",
  partial: "bg-amber-50 text-amber-700 ring-amber-600/20",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  reproduced: "bg-amber-50 text-amber-700 ring-amber-600/20",
  invited: "bg-amber-50 text-amber-700 ring-amber-600/20",
  running: "bg-sky-50 text-sky-700 ring-sky-600/20",
  indexing: "bg-sky-50 text-sky-700 ring-sky-600/20",
  INDEXING: "bg-sky-50 text-sky-700 ring-sky-600/20",
  open: "bg-sky-50 text-sky-700 ring-sky-600/20",
  draft: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

export function StatusPill({ value, label }: { value: string; label?: string }) {
  const live = value === "running" || value === "indexing" || value === "INDEXING";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        PILL[value] ?? "bg-slate-100 text-slate-600 ring-slate-500/10",
      )}
    >
      {live && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {label ?? value.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-fade-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<T | { value: T; label: string }>;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
      >
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand-600" : "bg-slate-300")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

export function ReadOnlyHint({ readOnly }: { readOnly: boolean }) {
  if (!readOnly) return null;
  return <p className="text-xs text-amber-700">Demo workspace · read-only. Switch to your organisation to make changes.</p>;
}

/** One-shot API action button usable from Server Components. */
export function ActionButton({
  url,
  method = "POST",
  json,
  children,
  loadingText,
  variant = "secondary",
  size = "sm",
  disabled,
  confirmText,
}: {
  url: string;
  method?: "POST" | "PATCH" | "DELETE";
  json?: unknown;
  children: React.ReactNode;
  loadingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  confirmText?: string;
}) {
  const { run, pending, error } = useAction();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        loading={pending === "a"}
        loadingText={loadingText}
        onClick={() => (!confirmText || window.confirm(confirmText)) && run("a", url, { method, json })}
      >
        {children}
      </Button>
      {error && <span role="alert" className="max-w-xs text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
