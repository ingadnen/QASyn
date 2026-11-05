"use client";

import { useId } from "react";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, label, description, disabled }: CheckboxProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      />
      <label htmlFor={id} className="cursor-pointer text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </label>
    </div>
  );
}
