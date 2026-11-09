"use client";

import { useState } from "react";
import { LinkTests } from "@/components/dashboard/pages/LinkTests";
import { Modal, useAction } from "@/components/dashboard/ui";

export function RequirementRowActions({
  requirement,
  testCases,
  linkedIds,
  readOnly,
}: {
  requirement: { id: string; code: string; title: string };
  testCases: Array<{ id: string; title: string }>;
  linkedIds: string[];
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const { run, pending, error } = useAction();

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        aria-label={`Actions for ${requirement.code}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl">
          <button
            role="menuitem"
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              setLinkOpen(true);
            }}
          >
            Link test cases
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={readOnly || pending === "del"}
            className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setOpen(false);
              void run("del", `/api/dashboard/requirements/${requirement.id}`, { method: "DELETE" });
            }}
          >
            {pending === "del" ? "Deleting…" : "Delete requirement"}
          </button>
          {error && <p role="alert" className="px-3 py-1 text-[11px] text-red-600">{error}</p>}
        </div>
      )}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title={`Link test cases — ${requirement.code}`}>
        <p className="mb-2 text-sm text-slate-600">{requirement.title}</p>
        {testCases.length === 0 ? (
          <p className="text-sm text-slate-500">No test cases exist yet. Generate some with + New Test Cases.</p>
        ) : (
          <LinkTests itemId={requirement.id} testCases={testCases} linkedIds={linkedIds} readOnly={readOnly} />
        )}
      </Modal>
    </div>
  );
}
