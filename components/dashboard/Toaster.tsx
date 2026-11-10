"use client";

import { useEffect, useRef, useState } from "react";
import { CqaIcon } from "@/components/dashboard/ui";
import { TOAST_EVENT, type ToastDetail, type ToastKind } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface ToastItem extends ToastDetail {
  id: number;
}

const TONE: Record<ToastKind, { icon: string; className: string }> = {
  success: { icon: "check_circle", className: "border-[#bbf7d0] bg-white text-[#166534]" },
  error: { icon: "error", className: "border-[#fecaca] bg-white text-[#b91c1c]" },
  info: { icon: "info", className: "border-[#c7d2fe] bg-white text-[#3730a3]" },
};

/** Bottom-right stack fed by the `qasyn:toast` window event. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      const id = nextId.current++;
      setItems((current) => [...current.slice(-3), { id, ...detail }]);
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, 4200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      data-toaster=""
      className="pointer-events-none fixed bottom-5 right-5 z-[10000] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      {items.map((item) => {
        const tone = TONE[item.kind];
        return (
          <div
            key={item.id}
            role="status"
            data-toast-kind={item.kind}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] shadow-[0_16px_40px_rgba(15,23,42,0.16)]",
              tone.className,
            )}
          >
            <CqaIcon name={tone.icon} className="mt-px text-[18px]" filled />
            <span className="min-w-0 flex-1 break-words">{item.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
              className="rounded p-0.5 opacity-60 transition hover:bg-black/5 hover:opacity-100"
            >
              <CqaIcon name="close" className="text-[15px]" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
