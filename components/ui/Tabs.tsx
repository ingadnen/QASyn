"use client";

import { cn } from "@/lib/utils";

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

/** Onglets segmentés (ex. macOS / Linux / Windows). */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<TabOption<T>>;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
