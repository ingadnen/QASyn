"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CqaIcon, cqaBtnPrimary, cqaCard, cqaIconBtn, useAction } from "@/components/dashboard/ui";
import { scopeLabel } from "@/lib/api-scopes";
import { cn } from "@/lib/utils";

export interface ApiTokenRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  ipCount: number;
}

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ApiTokensList({ tokens, readOnly }: { tokens: ApiTokenRow[]; readOnly: boolean }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");

  const rows = useMemo(() => {
    const now = Date.now();
    return tokens
      .map((t) => ({ ...t, status: t.expiresAt && new Date(t.expiresAt).getTime() < now ? "Expired" : "Active" }))
      .filter((t) => (status === "All statuses" ? true : t.status === status))
      .filter((t) => !query.trim() || `${t.name} ${t.prefix} ${t.scopes.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  }, [tokens, query, status]);

  async function revoke(id: string) {
    if (!window.confirm("Revoke this token? Scripts using it will stop working immediately.")) return;
    const res = await run(id, `/api/dashboard/api-tokens/${id}`, { method: "DELETE" });
    if (res) router.refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tokens"
            aria-label="Search tokens"
            className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#374151] outline-none focus:border-[#a9a1f7]"
        >
          {["All statuses", "Active", "Expired"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <Link href="/dashboard/settings/api-tokens/new" className={cn(cqaBtnPrimary, readOnly && "pointer-events-none opacity-50")}>
          <CqaIcon name="add" className="text-[17px]" /> Create token
        </Link>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-[12.5px] text-[#4a5565]">
        <CqaIcon name="bolt" className="text-[17px] text-[#d97706]" />
        Rate limit 120 req/min · Email send 10/hour
      </div>

      {error && <p className="mb-3 text-[12.5px] text-red-600">{error}</p>}

      {rows.length === 0 ? (
        <div className={cn(cqaCard, "px-5 py-12 text-center")}>
          <h3 className="text-[17px] font-semibold text-[#262626]">{tokens.length === 0 ? "No API tokens yet" : "No tokens match these filters"}</h3>
          <p className="mx-auto mt-2 max-w-xl text-[13px] leading-5 text-[#6b7280]">
            Create a token to let a script, CI job, or integration call the ContextQA API on your behalf. You choose its scopes and expiry, and see the value once.
          </p>
          <Link href="/dashboard/settings/api-tokens/new" className={cn(cqaBtnPrimary, "mt-5", readOnly && "pointer-events-none opacity-50")}>
            <CqaIcon name="add" className="text-[17px]" /> Create token
          </Link>
        </div>
      ) : (
        <div className={cn(cqaCard, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f0f1f3] bg-white">
                  {["Name", "Scopes", "Created", "Expires", "Last used", "Actions"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[13px] text-[#374151]">
                {rows.map((token) => (
                  <tr key={token.id} className="border-b border-[#f3f4f6] bg-white last:border-0 hover:bg-[#fafafa]">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-2 font-medium text-[#111827]">
                        <CqaIcon name="key" className="text-[17px] text-[#5b4ee8]" />
                        {token.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11.5px] text-[#6b7280]">{token.prefix}…</p>
                    </td>
                    <td className="max-w-[290px] px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {token.scopes.slice(0, 3).map((scope) => (
                          <span key={scope} className="rounded border border-[#e5e7eb] bg-[#f9fafb] px-1.5 py-[1px] text-[10.5px] text-[#4a5565]">{scopeLabel(scope)}</span>
                        ))}
                        {token.scopes.length > 3 && <span className="rounded border border-[#e5e7eb] bg-[#f9fafb] px-1.5 py-[1px] text-[10.5px] text-[#6b7280]">+{token.scopes.length - 3}</span>}
                        {token.scopes.length === 0 && <span className="text-[12px] text-[#9ca3af]">No scopes</span>}
                      </div>
                      {token.ipCount > 0 && <p className="mt-1 text-[11px] text-[#6b7280]">{token.ipCount} IP {token.ipCount === 1 ? "rule" : "rules"}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6b7280]">{fmt(token.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={cn("rounded border px-2 py-[2px] text-[11.5px]", token.status === "Expired" ? "border-[#fecaca] bg-[#fef2f2] text-[#dc2626]" : "border-[#b9f8cf] bg-[#f0fdf4] text-[#00a63e]")}>{token.status}</span>
                      <p className="mt-1 text-[11px] text-[#6b7280]">{token.expiresAt ? fmt(token.expiresAt) : "Never expires"}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#6b7280]">{token.lastUsedAt ? fmt(token.lastUsedAt) : "Never"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label={`Revoke ${token.name}`}
                        className={cqaIconBtn}
                        disabled={readOnly || pending === token.id}
                        onClick={() => revoke(token.id)}
                      >
                        <CqaIcon name="delete" className="text-[18px]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
            <span>Rows per page</span>
            <span className="tabular-nums">1–{rows.length} of {rows.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
