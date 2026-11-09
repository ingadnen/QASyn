"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaInput, cqaLabel, useAction } from "@/components/dashboard/ui";

export function CreateFolderButton({ readOnly }: { readOnly: boolean }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fileType, setFileType] = useState("Attachment");
  const [versioning, setVersioning] = useState(true);
  const [overwrite, setOverwrite] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("folder", "/api/dashboard/uploads", { json: { fileName: name, sizeBytes: 0, kind: "other" } });
    if (res) {
      setName("");
      setVersioning(true);
      setOverwrite(false);
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => setOpen(true)}>
        <CqaIcon name="add" className="text-[17px]" /> Create Folder
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Folder"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" form="folder-form" className={cqaBtnPrimary} disabled={readOnly || pending === "folder" || !name.trim()}>
              {pending === "folder" ? "Creating…" : "Create"}
            </button>
          </>
        }
      >
        <form id="folder-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={cqaLabel}>File Name *</span>
              <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Requirements" />
            </label>
            <label className="block">
              <span className={cqaLabel}>File Type*</span>
              <select className={cqaInput} value={fileType} onChange={(e) => setFileType(e.target.value)}>
                <option>Attachment</option>
                <option>Build</option>
                <option>Capture</option>
              </select>
            </label>
          </div>
          <div className="rounded-lg border border-[#f0f1f3] bg-[#fafafa] px-3 py-2.5">
            <p className="text-[12.5px] font-medium text-[#111827]">File Settings</p>
            <label className="mt-2 flex items-center gap-2 text-[12.5px] text-[#374151]">
              <input type="checkbox" checked={versioning} onChange={(e) => setVersioning(e.target.checked)} className="size-3.5 accent-[#5b4ee8]" /> Versioning
            </label>
            <p className="ml-6 text-[11.5px] text-[#9ca3af]">New uploads create versions</p>
            <label className="mt-2 flex items-center gap-2 text-[12.5px] text-[#374151]">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="size-3.5 accent-[#5b4ee8]" /> Overwrite existing file
            </label>
            <p className="ml-6 text-[11.5px] text-[#9ca3af]">Same-name uploads replace existing file</p>
          </div>
          {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
        </form>
      </Modal>
    </>
  );
}

export function DeleteUploadButton({ id, name, readOnly }: { id: string; name: string; readOnly: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <button
      type="button"
      aria-label={`Delete ${name}`}
      disabled={readOnly || pending === id}
      onClick={async () => {
        if (!window.confirm(`Delete "${name}"?`)) return;
        await run(id, `/api/dashboard/uploads/${id}`, { method: "DELETE" });
        router.refresh();
      }}
      className="inline-flex size-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-50"
    >
      <CqaIcon name="delete" className="text-[18px]" />
    </button>
  );
}

