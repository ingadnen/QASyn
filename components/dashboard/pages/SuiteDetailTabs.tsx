"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";

export function SuiteDetailTabs({
  suite,
  cases,
  allCases,
  readOnly,
}: {
  suite: { id: string; name: string; description: string | null; schedule: string; passRate: number; lastRunAt: string | null; linkedCaseIds: string[] };
  cases: Array<{ id: string; title: string; status: string }>;
  allCases: Array<{ id: string; title: string }>;
  readOnly: boolean;
}) {
  const [tab, setTab] = useState<"cases" | "plans" | "history" | "settings">("cases");
  const [pick, setPick] = useState("");
  const [name, setName] = useState(suite.name);
  const [description, setDescription] = useState(suite.description ?? "");
  const { run, pending, error } = useAction();
  const router = useRouter();

  async function toggleCase(caseId: string) {
    const linked = suite.linkedCaseIds.includes(caseId);
    const next = linked ? suite.linkedCaseIds.filter((c) => c !== caseId) : [...suite.linkedCaseIds, caseId];
    const res = await run("link", `/api/dashboard/collections/[ kind ][id]`.replace("[ kind ][id]", `suites/${suite.id}`), { method: "PATCH", json: { action: "link", testCaseIds: next } });
    if (res) router.refresh();
  }

  async function clone() {
    const res = await run<{ item: { id: string } }>("clone", "/api/dashboard/collections/suites", { json: { name: `${name} (copy)`, description, schedule: suite.schedule, module: "" } });
    if (res?.item) router.push(`/dashboard/plans/suites/${res.item.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs label="Suite sections" value={tab} onChange={setTab} options={[
          { value: "cases", label: `Test Cases (${cases.length})` },
          { value: "plans", label: "Used in Test Plans" },
          { value: "history", label: "History" },
          { value: "settings", label: "Settings" },
        ]} />
        <Button variant="secondary" size="sm" className="ml-auto" onClick={() => void clone()} loading={pending === "clone"} disabled={readOnly}>Clone Suite</Button>
      </div>

      {tab === "cases" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Pick a test case" value={pick} disabled={readOnly} onChange={(e) => setPick(e.target.value)} className="h-9 min-w-56 flex-1 rounded-lg border border-slate-200 px-2 text-sm">
              <option value="">Select a test case to attach…</option>
              {allCases.filter((c) => !suite.linkedCaseIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <Button size="sm" onClick={() => pick && void toggleCase(pick)} disabled={readOnly || !pick} loading={pending === "link"}>+ Add Test Case</Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {cases.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 text-slate-800">{c.title}</span>
                <span className="text-xs text-slate-500">{c.status}</span>
                <button type="button" className="text-xs font-semibold text-red-600 hover:underline" disabled={readOnly} onClick={() => void toggleCase(c.id)}>Remove</button>
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {tab === "plans" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Test plans using this suite appear here (see <a className="font-semibold text-brand-600 hover:underline" href="/dashboard/plans/test-plans">Test Plans</a>). Create one from the plans page with this suite in scope.
        </div>
      )}

      {tab === "history" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          Pass rate <strong>{Math.round(suite.passRate)}%</strong>
          {suite.lastRunAt ? ` · last run ${new Date(suite.lastRunAt).toLocaleString()}` : " · Not executed yet"}
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Suite name</span>
            <input className={cn("mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm")} value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Description</span>
            <textarea className={cn("mt-1 h-auto w-full rounded-lg border border-slate-200 px-3 py-2 text-sm")} rows={2} value={description} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <p className="text-xs text-slate-500">Tags: testsuite_tags · Folder: Unorganised · Execution: parallel · Schedule: {suite.schedule}</p>
        </div>
      )}
    </div>
  );
}
