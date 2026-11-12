/** Formatting helpers shared by server and client components (pure). */

export const tableCls = {
  table: "w-full text-left text-sm",
  th: "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500",
  td: "px-4 py-3 align-middle text-slate-700",
  tr: "border-t border-slate-100",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic (UTC) so server and client render the same text. */
export function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const hour = String(d.getUTCHours()).padStart(2, "0");
  const minute = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hour}:${minute} UTC`;
}

/** Deterministic UTC date-time in the live QASyn style: "07 Nov 2026 4:07:16 PM". */
export function formatDateTime(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()];
  const hours24 = d.getUTCHours();
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hour = hours24 % 12 || 12;
  const minute = String(d.getUTCMinutes()).padStart(2, "0");
  const second = String(d.getUTCSeconds()).padStart(2, "0");
  return `${day} ${month} ${d.getUTCFullYear()} ${hour}:${minute}:${second} ${suffix}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function timeAgo(iso: string | Date, now = Date.now()) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
