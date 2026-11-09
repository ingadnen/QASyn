"use client";

import { useState } from "react";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaInput, cqaLabel, useAction } from "@/components/dashboard/ui";

export function SimulatePrButton({ readOnly, nextNumber, hasRepo, compact }: { readOnly: boolean; nextNumber: number; hasRepo: boolean; compact?: boolean }) {
  const { run, pending, error, setError } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ prNumber: nextNumber, title: "", branch: "feature/", author: "", filesChanged: 6 });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    const res = await run("pr", "/api/dashboard/pull-requests", { json: form });
    if (res) {
      setOpen(false);
      setForm({ prNumber: form.prNumber + 1, title: "", branch: "feature/", author: form.author, filesChanged: 6 });
    }
  }

  return (
    <>
      {compact ? (
        <button type="button" disabled={readOnly} onClick={() => setOpen(true)} className="inline-flex size-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#5b4ee8] hover:bg-[#f9fafb]" aria-label="Analyse a pull request" title="Analyse a pull request">
          <CqaIcon name="add" className="text-[18px]" />
        </button>
      ) : (
        <button type="button" disabled={readOnly} onClick={() => setOpen(true)} className={cqaBtnPrimary}>
          <CqaIcon name="add" className="text-[17px]" /> Analyse pull request
        </button>
      )}
      <Modal
        open={open}
        onClose={() => {
          setError(null);
          setOpen(false);
        }}
        title="Analyse a pull request"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" form="pr-form" className={cqaBtnPrimary} disabled={readOnly || pending === "pr"}>
              {pending === "pr" ? "Analysing impact…" : "Run PR check (25 credits)"}
            </button>
          </>
        }
      >
        <form id="pr-form" onSubmit={submit} className="space-y-4">
          {!hasRepo && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              No repository connected: this PR is simulated locally. Connect GitHub or GitLab in Integrations for real-looking webhooks.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className={cqaLabel}>PR #</span>
              <input className={cqaInput} type="number" min={1} value={form.prNumber} onChange={(e) => setForm({ ...form, prNumber: Number(e.target.value) || 1 })} />
            </label>
            <label className="col-span-2 block">
              <span className={cqaLabel}>Files changed</span>
              <input className={cqaInput} type="number" min={1} max={5000} value={form.filesChanged} onChange={(e) => setForm({ ...form, filesChanged: Number(e.target.value) || 1 })} />
              <span className="mt-1 block text-[11px] text-[#9ca3af]">≥ 8 files = medium risk, ≥ 25 = high risk</span>
            </label>
          </div>
          <label className="block">
            <span className={cqaLabel}>Title</span>
            <input className={cqaInput} required minLength={3} maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fix checkout session handling" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={cqaLabel}>Branch</span>
              <input className={cqaInput} required maxLength={100} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
            </label>
            <label className="block">
              <span className={cqaLabel}>Author</span>
              <input className={cqaInput} required maxLength={60} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="jane" />
            </label>
          </div>
          {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
        </form>
      </Modal>
    </>
  );
}
