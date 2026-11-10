"use client";

import { useState } from "react";
import { MemberActions } from "@/components/dashboard/pages/TeamParity";
import { CqaIcon, StatusPill, cqaCard, cqaIconBtn } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  role: string;
  verified: boolean;
  status: string;
}

export function TeamTable({
  rows,
  currentUserEmail,
  readOnly,
}: {
  rows: TeamMemberRow[];
  currentUserEmail: string;
  readOnly: boolean;
}) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={cqaCard}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#f0f1f3] bg-[#fafafa]">
              {["NAME", "EMAIL", "ROLES", "VERIFIED", "ADMIN", ""].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold tracking-[0.08em] text-[#9ca3af]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <p className="text-[14px] font-medium text-[#374151]">No users found</p>
                  <p className="mt-1 text-[12.5px] text-[#9ca3af]">Invite a teammate to get started.</p>
                </td>
              </tr>
            )}
            {visible.map((member) => (
              <tr key={member.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-full bg-[#eef2ff] text-[10.5px] font-semibold text-[#5b4ee8]">{member.avatarInitials}</span>
                    <span className="font-medium text-[#1f2937]">{member.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{member.email}</td>
                <td className="px-4 py-3 text-[12.5px] text-[#6b7280]">{member.role === "Admin" ? "—" : member.role}</td>
                <td className="px-4 py-3">
                  {member.verified ? (
                    <CqaIcon name="check_circle" className="text-[18px] text-[#00a63e]" />
                  ) : (
                    <StatusPill value="invited" label="Invited" />
                  )}
                </td>
                <td className="px-4 py-3 text-[12.5px] font-medium text-[#4b5563]">{member.role === "Admin" ? "Admin" : "—"}</td>
                <td className="px-4 py-3">
                  <MemberActions
                    memberId={member.id}
                    memberName={member.name}
                    role={member.role}
                    invited={member.status === "invited"}
                    readOnly={readOnly || member.email === currentUserEmail}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            aria-label="Rows per page"
            className="h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="tabular-nums">
            {rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} of {rows.length}
          </span>
          <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className={cn(cqaIconBtn, "size-7 border border-[#e5e7eb] bg-white disabled:opacity-40")}>
            <CqaIcon name="chevron_left" className="text-[16px]" />
          </button>
          <button type="button" aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} className={cn(cqaIconBtn, "size-7 border border-[#e5e7eb] bg-white disabled:opacity-40")}>
            <CqaIcon name="chevron_right" className="text-[16px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
