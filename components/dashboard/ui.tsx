"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Calls an API route then refreshes the server components of the page. */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(
      key: string,
      url: string,
      init: { method?: "POST" | "PATCH" | "DELETE"; json?: unknown; success?: string } = {},
    ): Promise<T | null> => {
      setPending(key);
      setError(null);
      try {
        const res = await apiFetch<T>(url, { method: init.method ?? "POST", json: init.json });
        toast(init.success ?? "Saved.", "success");
        router.refresh();
        return res;
      } catch (e) {
        const message = errorMessage(e);
        setError(message);
        toast(message, "error");
        return null;
      } finally {
        setPending(null);
      }
    },
    [router],
  );

  return { run, pending, error, setError };
}

/* ---------------------------------------------------------------------------
 * ContextQA design tokens (captured from gmailad.contextqa.com)
 * ------------------------------------------------------------------------- */

export const cqa = {
  primary: "#5b4ee8",
  primaryHover: "#6d61ff",
  ink: "#111827",
  muted: "#6b7280",
  line: "#e5e7eb",
  surface: "#ffffff",
  canvas: "#f7f8fa",
  headBg: "#ffffff",
  headText: "#6b7280",
};

export const cqaBtnPrimary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#5b4ee8] px-3.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#6d61ff] disabled:cursor-not-allowed disabled:opacity-50";
export const cqaBtnSecondary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[13px] font-medium text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50";
export const cqaBtnGhost =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827]";
export const cqaIconBtn =
  "inline-flex size-8 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827]";
export const cqaCard = "rounded-[11px] border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]";
export const cqaInput =
  "h-9 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]";
export const cqaLabel = "mb-1.5 block text-[12.5px] font-medium text-[#374151]";

export function CqaIcon({ name, className, filled }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined select-none leading-none", className)}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
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
    <div className="flex flex-wrap items-start justify-between gap-4" data-kicker={kicker}>
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-[#111827]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[13.5px] leading-5 text-[#6b7280]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, title, actions }: { className?: string; children: React.ReactNode; title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={cn(cqaCard, className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-[#f0f1f3] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#111827]">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-[#f3f4f6] text-[#9ca3af]" aria-hidden="true">
        <CqaIcon name="inbox" className="text-[24px]" />
      </div>
      <p className="text-[14px] font-medium text-[#374151]">{title}</p>
      {description && <p className="max-w-sm text-[12.5px] text-[#9ca3af]">{description}</p>}
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

const TONE: Record<string, string> = {
  green: "bg-[#f0fdf4] text-[#00a63e] border-[#b9f8cf]",
  red: "bg-[#fef2f2] text-[#dc2626] border-[#fecaca]",
  amber: "bg-[#fffbeb] text-[#d97706] border-[#fde68a]",
  blue: "bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]",
  gray: "bg-[#f9fafb] text-[#6b7280] border-[#e5e7eb]",
  purple: "bg-[#f5f3ff] text-[#5b4ee8] border-[#ddd6fe]",
};

function toneFor(value: string): keyof typeof TONE {
  const v = value.toLowerCase();
  if (["passing", "passed", "pass", "completed", "complete", "covered", "ready", "active", "connected", "success", "indexed", "fixed", "reproduced"].includes(v)) return "green";
  if (["failing", "failed", "fail", "error", "uncovered", "regression_caught", "critical", "blocked"].includes(v)) return "red";
  if (["pending", "pending action", "pending_action", "partial", "medium", "flaky", "invited", "in review", "in_progress", "in progress", "warning"].includes(v)) return "amber";
  if (["running", "indexing", "open", "in progress", "queued"].includes(v)) return "blue";
  if (["high", "no-go", "no go"].includes(v)) return "red";
  if (["low", "draft", "idle", "not executed", "not_executed", "none", "off", "archived"].includes(v)) return "gray";
  return "gray";
}

export function StatusPill({ value, label }: { value: string; label?: string }) {
  const live = ["running", "indexing", "indexing"].includes(value.toLowerCase());
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-[2px] text-[12px] font-medium leading-[17px]",
        TONE[toneFor(label ?? value)],
      )}
    >
      {live && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {label ?? titleCase(value.replace(/_/g, " "))}
    </span>
  );
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (m) => m.toUpperCase());
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : size === "xl" ? "max-w-4xl" : "max-w-[560px]";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0f172a]/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("animate-fade-in flex max-h-[92vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_64px_rgba(15,23,42,0.24)]", width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#f0f1f3] px-6 py-4">
          <h2 className="text-[17px] font-semibold text-[#111827]">{title}</h2>
          <button type="button" onClick={onClose} className={cqaIconBtn} aria-label="Close">
            <CqaIcon name="close" className="text-[20px]" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#f0f1f3] px-6 py-3.5">{footer}</footer>}
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
      <span className={cqaLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cqaInput}>
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
        <p className="text-[13px] font-medium text-[#111827]">{label}</p>
        {description && <p className="mt-0.5 text-[12px] text-[#6b7280]">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative h-[22px] w-[40px] shrink-0 rounded-full transition", checked ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
      >
        <span className={cn("absolute top-[3px] size-4 rounded-full bg-white shadow transition", checked ? "left-[21px]" : "left-[3px]")} />
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
