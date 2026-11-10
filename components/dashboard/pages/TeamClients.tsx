"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const ROLES = ["Admin", "Founder", "Eng manager", "Engineer", "QA", "BA / FA"] as const;

export function RoleChanger({ memberId, role, readOnly }: { memberId: string; role: string; readOnly: boolean }) {
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(role);
  return (
    <select
      aria-label="Change role"
      className="h-8 rounded-lg border border-slate-200 px-2 text-xs"
      value={current}
      disabled={readOnly || busy}
      onChange={async (e) => {
        const next = e.target.value;
        setCurrent(next);
        setBusy(true);
        try {
          await apiFetch(`/api/dashboard/team/${memberId}`, { method: "PATCH", json: { role: next } });
        } catch {
          /* ignore */
        } finally {
          setBusy(false);
        }
      }}
    >
      {ROLES.map((r) => <option key={r}>{r}</option>)}
    </select>
  );
}

const PERM_LABELS = ["Crawl", "Test Studio", "Suites & Plans", "Environments & Data", "Billing & usage", "API Tokens", "System audits"] as const;
type Perm = (typeof PERM_LABELS)[number];

const DEFAULT_PERMS: Record<Perm, Record<string, boolean>> = {
  "Crawl": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true, "BA / FA": false },
  "Test Studio": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true, "BA / FA": true },
  "Suites & Plans": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: true, "BA / FA": true },
  "Environments & Data": { Admin: true, Founder: true, "Eng manager": true, Engineer: true, QA: false, "BA / FA": false },
  "Billing & usage": { Admin: true, Founder: true, "Eng manager": false, Engineer: false, QA: false, "BA / FA": false },
  "API Tokens": { Admin: true, Founder: true, "Eng manager": false, Engineer: false, QA: false, "BA / FA": false },
  "System audits": { Admin: true, Founder: true, "Eng manager": true, Engineer: false, QA: false, "BA / FA": false },
};

/** Interactive permission matrix, persisted to the organisation settingsJson. */
export function PermissionsMatrix({ initial, readOnly }: { initial: Record<Perm, Record<string, boolean>>; readOnly: boolean }) {
  const [perms, setPerms] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle(perm: Perm, role: string) {
    const next = { ...perms, [perm]: { ...perms[perm], [role]: !perms[perm][role] } };
    setPerms(next);
    setSaved(false);
    setBusy(true);
    try {
      await apiFetch("/api/dashboard/settings/organization", { method: "PATCH", json: { permissions: next } });
      setSaved(true);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="py-2 pr-3 font-semibold text-slate-700">Permission</th>
              {ROLES.map((r) => <th key={r} className="py-2 pr-3 font-semibold text-slate-700">{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERM_LABELS.map((label) => (
              <tr key={label} className="border-b border-slate-50">
                <td className="py-2 pr-3 text-slate-700">{label}</td>
                {ROLES.map((r) => (
                  <td key={r} className="py-2 pr-3">
                    <button
                      type="button"
                      disabled={readOnly || busy}
                      aria-pressed={perms[label][r]}
                      onClick={() => void toggle(label, r)}
                      className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold", perms[label][r] ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}
                    >
                      {perms[label][r] ? "✓" : "—"}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{saved ? "✓ Saved to organisation settings (settingsJson)." : "Click a cell to toggle — persisted to settingsJson."}</p>
      <Button size="sm" variant="secondary" onClick={() => setPerms(DEFAULT_PERMS)}>Reset defaults</Button>
    </div>
  );
}
