"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaInput, cqaLabel, useAction } from "@/components/dashboard/ui";

export function KnowledgeCreateButton({ readOnly }: { readOnly: boolean }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("kb", "/api/dashboard/knowledge-base", {
      json: { title: name, type: "doc", urlOrPath: description || name },
    });
    if (res) {
      setName("");
      setDescription("");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setOpen(true)}>
        <CqaIcon name="add" className="text-[17px]" /> Add
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Knowledge Base"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" form="kb-form" className={cqaBtnPrimary} disabled={readOnly || pending === "kb" || !name.trim() || !description.trim()}>
              {pending === "kb" ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="kb-form" onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className={cqaLabel}>Name *</span>
            <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} required maxLength={30} placeholder="Product documentation" />
            <span className="mt-1 block text-right text-[11px] tabular-nums text-[#9ca3af]">{name.length}/30</span>
          </label>
          <label className="block">
            <span className={cqaLabel}>Description *</span>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px] outline-none focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="What knowledge does this base hold?"
            />
          </label>
          {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
        </form>
      </Modal>
    </>
  );
}

export function DeleteKnowledgeButton({ id, name, readOnly }: { id: string; name: string; readOnly: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <button
      type="button"
      aria-label={`Delete ${name}`}
      disabled={readOnly || pending === id}
      onClick={async () => {
        if (!window.confirm(`Delete "${name}"?`)) return;
        await run(id, `/api/dashboard/knowledge-base/${id}`, { method: "DELETE" });
        router.refresh();
      }}
      className="inline-flex size-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-50"
    >
      <CqaIcon name="delete" className="text-[18px]" />
    </button>
  );
}
