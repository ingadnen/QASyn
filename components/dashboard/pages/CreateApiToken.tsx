"use client";

import Link from "next/link";
import { useState } from "react";
import { CqaIcon, useAction } from "@/components/dashboard/ui";
import { API_SCOPES } from "@/lib/api-scopes";
import { cn } from "@/lib/utils";

interface Props {
  readOnly: boolean;
  existingNames: string[];
}

const inputCls =
  "h-[41px] w-full rounded-md border border-[#d1d5db] bg-white px-3 text-[14px] text-[#0a0a0a] outline-none transition placeholder:text-[#9ca3af] focus:border-[#8b80ff] focus:ring-2 focus:ring-[#e4e1fd]";
const labelCls = "mb-2 block text-[14px] font-medium text-[#374151]";
const helpCls = "mt-1.5 block text-[12.5px] leading-5 text-[#6b7280]";
const cardCls = "mt-5 rounded-[12px] border border-[#dbdee5] bg-white p-[25px] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]";

function expiryLabel(days: number | null) {
  if (days === null) return "Never expires";
  return `Expires ${new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function CreateApiToken({ readOnly, existingNames }: Props) {
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [expires, setExpires] = useState<number | null>(30);
  const [selected, setSelected] = useState<string[]>([]);
  const [ipOpen, setIpOpen] = useState(false);
  const [ipText, setIpText] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const duplicate = existingNames.some((existing) => existing.toLowerCase() === name.trim().toLowerCase());
  const ipList = ipText.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);
  const invalidIp = ipList.some((v) => !/^[0-9a-fA-F:.]+(\/\d{1,3})?$/.test(v));
  const canCreate = !readOnly && name.trim().length >= 2 && selected.length > 0 && !duplicate && !invalidIp;

  function toggleScope(id: string) {
    setError(null);
    if (id === "FULL_ACCESS") {
      setSelected((prev) => (prev.includes("FULL_ACCESS") ? [] : ["FULL_ACCESS"]));
      return;
    }
    setSelected((prev) => {
      const withoutFull = prev.filter((s) => s !== "FULL_ACCESS");
      return withoutFull.includes(id) ? withoutFull.filter((s) => s !== id) : [...withoutFull, id];
    });
  }

  async function create() {
    setError(null);
    const res = await run("create", "/api/dashboard/api-tokens", {
      method: "POST",
      json: { name: name.trim(), scopes: selected, expiresInDays: expires, ipAllowlist: ipList },
    });
    if (res) {
      const data = res as { token?: string };
      setCreated(data.token ?? "");
    }
  }

  async function copyToken() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (created) {
    return (
      <div className="pb-10">
        <Link href="/dashboard/settings/api-tokens" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6b7280] hover:text-[#111827]">
          <CqaIcon name="arrow_back" className="text-[18px]" /> Back to API Tokens
        </Link>
        <div className={cn(cardCls, "mt-5 max-w-3xl")}>
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#f0fdf4] text-[#00a63e]"><CqaIcon name="key" className="text-[22px]" /></span>
            <div>
              <h1 className="text-[20px] font-bold text-[#101828]">API token created</h1>
              <p className="mt-1 text-[13.5px] text-[#4a5565]">Copy this token now. It is never shown again.</p>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[12.5px] leading-5 text-[#92400e]">
            <strong className="font-semibold">The token value is shown once.</strong> Store it in your secret manager before leaving this page.
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-3">
            <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-[#111827]">{created}</code>
            <button type="button" onClick={copyToken} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#d1d5db] bg-white px-2.5 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb]">
              <CqaIcon name={copied ? "check" : "content_copy"} className="text-[16px]" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-5 flex justify-end border-t border-[#f0f1f3] pt-4">
            <Link href="/dashboard/settings/api-tokens" className="inline-flex h-9 items-center rounded-lg bg-[#5b4ee8] px-4 text-[13px] font-medium text-white hover:bg-[#6d61ff]">
              Done
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <Link href="/dashboard/settings/api-tokens" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6b7280] hover:text-[#111827]">
        <CqaIcon name="arrow_back" className="text-[18px]" /> Back to API Tokens
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-[#f5f3ff] text-[#5b4ee8]"><CqaIcon name="key" className="text-[22px]" /></span>
        <h1 className="text-[20px] font-bold leading-7 text-[#101828]">Create API token</h1>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#6b7280]">
        <span className="inline-flex items-center gap-1.5"><CqaIcon name="key" className="text-[15px]" /> API Token</span>
        <span className="text-[#d1d5db]">|</span>
        <span>{selected.length === 0 ? "No scopes" : `${selected.length} scope${selected.length === 1 ? "" : "s"}`}</span>
        <span className="text-[#d1d5db]">|</span>
        <span className="inline-flex items-center gap-1.5"><CqaIcon name="calendar_month" className="text-[15px]" /> {expiryLabel(expires)}</span>
      </div>
      <p className="mt-4 max-w-3xl text-[14px] leading-6 text-[#4a5565]">
        Give the token a recognisable name, pick the narrowest set of scopes that works, and decide where it may be called from.
      </p>

      <div className="mt-5 flex max-w-3xl gap-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[12.5px] leading-5 text-[#991b1b]">
        <CqaIcon name="warning" className="mt-0.5 shrink-0 text-[18px]" />
        <p>
          <strong className="font-semibold">The token value is shown once, on creation.</strong> It is never stored in a readable form, so it cannot be retrieved, resent, or recovered afterwards — copy it into your secret store before closing the dialog. If it is lost, delete the token and create a new one.
        </p>
      </div>

      <section className={cardCls}>
        <div className="flex items-center gap-2">
          <CqaIcon name="badge" className="text-[20px] text-[#5b4ee8]" />
          <h3 className="text-[17px] font-semibold text-[#262626]">Details</h3>
        </div>
        <p className="mt-1 text-[12.5px] text-[#6b7280]">The name is a label only — it never affects access.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Name <span className="text-[#ef4444]">*</span></span>
            <input className={inputCls} placeholder="e.g. CI Pipeline" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} disabled={readOnly} maxLength={255} />
            <span className={cn(helpCls, duplicate && "text-red-600")}>{duplicate ? "A token with this name already exists." : "Must be unique among your active tokens. Max 255 characters."}</span>
          </label>
          <label className="block">
            <span className={labelCls}>Expires</span>
            <select className={inputCls} value={expires === null ? "never" : String(expires)} onChange={(e) => setExpires(e.target.value === "never" ? null : Number(e.target.value))} disabled={readOnly}>
              <option value="7">7 days</option>
              <option value="30">30 days (default)</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="never">Never expire</option>
            </select>
            <span className={helpCls}>The server rejects anything beyond 180 days from creation, unless Never expire is selected.</span>
          </label>
        </div>
      </section>

      <section className={cardCls}>
        <div className="flex flex-wrap items-center gap-2">
          <CqaIcon name="verified_user" className="text-[20px] text-[#5b4ee8]" />
          <h3 className="text-[17px] font-semibold text-[#262626]">Permissions</h3>
          <span className="ml-auto text-[12.5px] text-[#6b7280]">{selected.length === 0 ? "None selected" : `${selected.length} selected`}</span>
          <button type="button" onClick={() => setSelected([])} disabled={readOnly || selected.length === 0} className="text-[12.5px] font-medium text-[#5b4ee8] hover:underline disabled:opacity-40">Clear all</button>
        </div>
        <p className="mt-1 text-[12.5px] text-[#6b7280]">At least one scope is required. Each scope maps to a fixed set of routes.</p>

        <div className="mt-4 divide-y divide-[#f0f1f3] rounded-lg border border-[#e5e7eb]">
          {API_SCOPES.map((scope) => {
            const checked = selected.includes(scope.id);
            return (
              <label key={scope.id} className="flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-[#fafafa]">
                <input type="checkbox" className="mt-1 size-4 rounded border-[#d1d5db] accent-[#5b4ee8]" checked={checked} onChange={() => toggleScope(scope.id)} disabled={readOnly} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-medium text-[#262626]">{scope.label}</span>
                    {scope.risk === "high" && (
                      <span className="inline-flex items-center gap-1 rounded border border-[#fecaca] bg-[#fef2f2] px-1.5 py-[1px] text-[10.5px] text-[#dc2626]">
                        <CqaIcon name="priority_high" className="text-[11px]" /> High abuse risk
                      </span>
                    )}
                    {scope.risk === "broad" && (
                      <span className="inline-flex items-center gap-1 rounded border border-[#ddd6fe] bg-[#f5f3ff] px-1.5 py-[1px] text-[10.5px] text-[#5b4ee8]">
                        <CqaIcon name="all_inclusive" className="text-[11px]" /> Broad
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-[#6b7280]">{scope.routes}</span>
                </span>
                <CqaIcon name={scope.icon} className="mt-0.5 text-[17px] text-[#9ca3af]" />
              </label>
            );
          })}
        </div>
      </section>

      <section className={cardCls}>
        <button type="button" onClick={() => setIpOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
          <CqaIcon name="shield" className="text-[20px] text-[#5b4ee8]" />
          <span className="text-[17px] font-semibold text-[#262626]">Advanced — IP allowlist</span>
          <span className="ml-auto flex items-center gap-2 text-[12.5px] text-[#6b7280]">
            {ipList.length === 0 ? "Unrestricted" : `${ipList.length} rule${ipList.length === 1 ? "" : "s"}`}
            <CqaIcon name="expand_more" className={cn("text-[18px] transition", ipOpen && "rotate-180")} />
          </span>
        </button>
        <p className="mt-1 text-[12.5px] text-[#6b7280]">Enforced before authentication. Unrestricted by default.</p>
        {ipOpen && (
          <label className="mt-4 block">
            <span className={labelCls}>Allowed IPs / CIDR ranges</span>
            <textarea
              className={cn(inputCls, "h-auto min-h-[90px] resize-y py-2.5 font-mono text-[13px]")}
              placeholder={"203.0.113.10\n10.0.0.0/8"}
              value={ipText}
              onChange={(e) => setIpText(e.target.value)}
              disabled={readOnly}
            />
            <span className={cn(helpCls, invalidIp && "text-red-600")}>{invalidIp ? "Use IPv4/IPv6 addresses or CIDR ranges, one per line." : "One IP or CIDR range per line. Leave empty to allow all addresses."}</span>
          </label>
        )}
      </section>

      {error && <p className="mt-4 text-[12.5px] text-red-600">{error}</p>}
      {readOnly && <p className="mt-4 text-[12.5px] text-amber-700">Demo workspace · read-only. Switch to your organisation to create tokens.</p>}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[#e5e7eb] pt-5">
        <p className="mr-auto text-[12.5px] text-[#6b7280]">The token value appears once, right after you create it.</p>
        <Link href="/dashboard/settings/api-tokens" className="inline-flex h-9 items-center rounded-lg border border-[#d1d5db] bg-white px-3.5 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb]">Cancel</Link>
        <button
          type="button"
          onClick={create}
          disabled={!canCreate || pending === "create"}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#5b4ee8] px-3.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#6d61ff] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CqaIcon name="key" className="text-[17px]" />
          {pending === "create" ? "Creating…" : "Create token"}
        </button>
      </div>
    </div>
  );
}
