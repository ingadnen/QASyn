"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CqaIcon, Modal, StatusPill, cqaBtnSecondary, cqaLabel, useAction } from "@/components/dashboard/ui";
import { RowMenu } from "@/components/contextqa/row-menu";
import { toast } from "@/lib/toast";

export interface CodeAnalysisRow {
  id: string;
  provider: string;
  detail: string;
  branch: string;
  modules: number;
  files: number;
  status: string;
  analysedAt: string;
}

export function CodeAnalysisRowActions({ row, readOnly }: { row: CodeAnalysisRow; readOnly: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);

  async function rerun() {
    const res = await run("rerun", "/api/dashboard/code-analysis", {
      method: "POST",
      success: `Analysis re-queued for ${row.provider.toLowerCase()}.`,
    });
    if (res) router.refresh();
  }

  function exportReport() {
    const lines = [
      ["Repository", "Detail", "Branch", "Modules", "Files", "Status", "Analysed"].join(","),
      [row.provider, row.detail, row.branch, row.modules, row.files, row.status, row.analysedAt]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `code-analysis-${row.provider.toLowerCase()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast("Analysis report exported.", "success");
  }

  return (
    <>
      <RowMenu
        label={`Actions for ${row.provider.toLowerCase()} analysis`}
        items={[
          { label: "View analysis", icon: "visibility", onSelect: () => setOpen(true) },
          { label: "Re-run analysis", icon: "refresh", disabled: readOnly || pending === "rerun", onSelect: () => void rerun() },
          { label: "Export report", icon: "download", onSelect: exportReport },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Analysis details"
        footer={<button type="button" className={cqaBtnSecondary} onClick={() => setOpen(false)}>Close</button>}
      >
        <dl className="space-y-2 text-[13px]">
          {[
            ["Repository", row.provider.toLowerCase()],
            ["Detail", row.detail],
            ["Branch", row.branch],
            ["Modules", String(row.modules)],
            ["Files analysed", String(row.files)],
            ["Analysed", new Date(row.analysedAt).toLocaleString("en-GB")],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 border-b border-[#f3f4f6] py-2 last:border-0">
              <dt className={cqaLabel}>{label}</dt>
              <dd className="max-w-[60%] text-right text-[#374151]">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-1">
            <dt className={cqaLabel}>Status</dt>
            <dd><StatusPill value={row.status} /></dd>
          </div>
        </dl>
      </Modal>
    </>
  );
}
