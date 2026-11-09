"use client";

import { useState } from "react";
import { RequirementCreate } from "@/components/dashboard/pages/Forms";
import { Modal } from "@/components/dashboard/ui";

export function NewRequirementButton({ readOnly }: { readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500"
      >
        + New Requirement
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New Requirement">
        <RequirementCreate readOnly={readOnly} />
      </Modal>
    </>
  );
}
