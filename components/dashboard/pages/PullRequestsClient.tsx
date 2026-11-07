"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorNote, Modal, useAction } from "../ui";

export function SimulatePrButton({ readOnly, nextNumber, hasRepo }: { readOnly: boolean; nextNumber: number; hasRepo: boolean }) {
  const { run, pending, error, setError } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ prNumber: nextNumber, title: "", branch: "feature/", author: "", filesChanged: 6 });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("pr", "/api/dashboard/pull-requests", { json: form });
    if (res) {
      setOpen(false);
      setForm({ prNumber: form.prNumber + 1, title: "", branch: "feature/", author: form.author, filesChanged: 6 });
    }
  }

  return (
    <>
      <Button disabled={readOnly} onClick={() => setOpen(true)}>
        + Simulate pull request
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setError(null);
          setOpen(false);
        }}
        title="Simulate a pull request"
      >
        <form onSubmit={submit} className="space-y-4">
          {!hasRepo && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No repository connected: this PR is simulated locally. Connect GitHub or GitLab in Integrations for real-looking webhooks.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Input label="PR #" type="number" min={1} value={form.prNumber} onChange={(e) => setForm({ ...form, prNumber: Number(e.target.value) || 1 })} />
            <Input
              label="Files changed"
              type="number"
              min={1}
              max={5000}
              value={form.filesChanged}
              onChange={(e) => setForm({ ...form, filesChanged: Number(e.target.value) || 1 })}
              className="col-span-2"
              hint="≥ 8 files = medium risk, ≥ 25 = high risk"
            />
          </div>
          <Input label="Title" required minLength={3} maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fix checkout session handling" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Branch" required maxLength={100} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
            <Input label="Author" required maxLength={60} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="jane" />
          </div>
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending === "pr"} loadingText="Analysing impact…">
              Run PR check (25 credits)
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
