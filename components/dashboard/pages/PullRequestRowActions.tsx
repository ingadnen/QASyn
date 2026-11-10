"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CqaIcon, Modal, StatusPill, cqaBtnSecondary, cqaLabel, useAction } from "@/components/dashboard/ui";
import { RowMenu } from "@/components/contextqa/row-menu";
import { toast } from "@/lib/toast";

export interface PullRequestRow {
  id: string;
  prNumber: number;
  title: string;
  branch: string;
  author: string;
  filesChanged: number;
  riskLevel: string;
  status: string;
  testsRun: number;
  regressions: number;
  createdAt: string;
}

function verdictLabel(row: PullRequestRow) {
  if (row.status === "running") return "Analysing";
  if (row.status === "regression_caught") return `${row.regressions} regression${row.regressions === 1 ? "" : "s"} caught`;
  return "Passed baseline";
}

export function PullRequestRowActions({ row, readOnly }: { row: PullRequestRow; readOnly: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);

  async function rerun() {
    const res = await run("rerun", "/api/dashboard/pull-requests", {
      method: "PATCH",
      json: { id: row.id },
      success: `Analysis re-ran for PR #${row.prNumber}.`,
    });
    if (res) router.refresh();
  }

  function exportReport() {
    const lines = [
      ["PR", "Title", "Branch", "Author", "Files", "Risk", "Tests run", "Verdict", "Opened"].join(","),
      [
        `#${row.prNumber}`,
        row.title,
        row.branch,
        row.author,
        row.filesChanged,
        row.riskLevel,
        row.testsRun,
        verdictLabel(row),
        row.createdAt,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pr-${row.prNumber}-impact-report.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast(`PR #${row.prNumber} report exported.`, "success");
  }

  return (
    <>
      <RowMenu
        label={`Actions for PR #${row.prNumber}`}
        items={[
          { label: "View details", icon: "visibility", onSelect: () => setOpen(true) },
          { label: "Re-run analysis", icon: "refresh", disabled: readOnly || pending === "rerun", onSelect: () => void rerun() },
          { label: "Export report", icon: "download", onSelect: exportReport },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`PR #${row.prNumber}`}
        size="lg"
        footer={<button type="button" className={cqaBtnSecondary} onClick={() => setOpen(false)}>Close</button>}
      >
        <div className="space-y-3">
          <div>
            <p className="text-[15px] font-semibold text-[#111827]">{row.title}</p>
            <p className="mt-0.5 font-mono text-[12px] text-[#6b7280]">{row.branch} · @{row.author}</p>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            {[
              ["Risk level", row.riskLevel.charAt(0).toUpperCase() + row.riskLevel.slice(1)],
              ["Files changed", String(row.filesChanged)],
              ["Tests run", String(row.testsRun)],
              ["Verdict", verdictLabel(row)],
              ["Opened", new Date(row.createdAt).toLocaleString("en-GB")],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[#f0f1f3] bg-[#fcfcfd] px-3 py-2">
                <dt className={cqaLabel}>{label}</dt>
                <dd className="text-[13px] text-[#374151]">{value}</dd>
              </div>
            ))}
            <div className="rounded-lg border border-[#f0f1f3] bg-[#fcfcfd] px-3 py-2">
              <dt className={cqaLabel}>Status</dt>
              <dd><StatusPill value={row.status} label={verdictLabel(row)} /></dd>
            </div>
          </dl>
          <div className="rounded-lg border border-[#f0f1f3] px-3 py-2.5 text-[12.5px] leading-5 text-[#6b7280]">
            <p className="inline-flex items-center gap-1.5 font-medium text-[#374151]">
              <CqaIcon name="account_tree" className="text-[16px] text-[#5b4ee8]" /> Impact analysis
            </p>
            <p className="mt-1">
              {row.riskLevel === "high"
                ? "High-risk change: regressions were detected in the baseline suite. Review the failing tests before merging."
                : row.riskLevel === "medium"
                  ? "Medium-risk change: baseline tests passed, but broader regression coverage is recommended."
                  : "Low-risk change: all affected baseline tests passed."}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
