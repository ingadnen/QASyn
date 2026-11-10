export type ToastKind = "success" | "error" | "info";

export interface ToastDetail {
  message: string;
  kind: ToastKind;
}

export const TOAST_EVENT = "qasyn:toast";

/** Fire a global toast. Safe to call during SSR (no-op). */
export function toast(message: string, kind: ToastKind = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, kind } }));
}
