"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ColumnFilter, ColumnSort, matchesColumnFilters, nextTableSort, sortTableRows, type TableSortState } from "@/components/contextqa/table-ui";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaInput, cqaLabel, useAction } from "@/components/dashboard/ui";
import { formatDateTime } from "@/lib/format";

export interface UploadTableRow {
  id: string;
  fileName: string;
  kind: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

/** Phase 10 — uploads grid with full per-column header filtering. */
export function UploadsTable({ rows, readOnly }: { rows: UploadTableRow[]; readOnly: boolean }) {
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<TableSortState>(null);
  const visibleRows = useMemo(
    () =>
      sortTableRows(
        rows.filter((row) =>
          matchesColumnFilters(columnFilters, {
            "File Name": `${row.fileName} ${row.uploadedBy}`,
            Type: row.kind === "other" && row.sizeBytes === 0 ? "folder" : row.kind,
            Size: row.sizeBytes === 0 ? "—" : `${(row.sizeBytes / 1024).toFixed(0)} KB`,
            "Uploaded by": row.uploadedBy,
            Created: formatDateTime(row.createdAt),
          }),
        ),
        sort,
        {
          "File Name": (row) => row.fileName,
          Type: (row) => (row.kind === "other" && row.sizeBytes === 0 ? "folder" : row.kind),
          Size: (row) => row.sizeBytes,
          "Uploaded by": (row) => row.uploadedBy,
          Created: (row) => row.createdAt,
        },
      ),
    [rows, columnFilters, sort],
  );
  const setFilter = (column: string, value: string) => setColumnFilters((current) => ({ ...current, [column]: value }));
  const sortColumn = (column: string) => setSort((current) => nextTableSort(current, column));

  return (
    <div data-testid="uploads-table">
      {visibleRows.length === 0 ? (
        <div className="px-4 py-14 text-center">
          <p className="text-[14px] font-medium text-[#374151]">No data available</p>
          <p className="mt-1 text-[12.5px] text-[#9ca3af]">There is no data available to display.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#f0f1f3]">
                <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">File Name<ColumnFilter column="File Name" value={columnFilters["File Name"] ?? ""} onChange={(value) => setFilter("File Name", value)} /><ColumnSort column="File Name" sort={sort} onSort={sortColumn} /></th>
                <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Type<ColumnFilter column="Type" value={columnFilters.Type ?? ""} onChange={(value) => setFilter("Type", value)} options={[...new Set(rows.map((row) => (row.kind === "other" && row.sizeBytes === 0 ? "folder" : row.kind)))]} /><ColumnSort column="Type" sort={sort} onSort={sortColumn} /></th>
                <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Size<ColumnFilter column="Size" value={columnFilters.Size ?? ""} onChange={(value) => setFilter("Size", value)} /><ColumnSort column="Size" sort={sort} onSort={sortColumn} /></th>
                <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Uploaded by<ColumnFilter column="Uploaded by" value={columnFilters["Uploaded by"] ?? ""} onChange={(value) => setFilter("Uploaded by", value)} options={[...new Set(rows.map((row) => row.uploadedBy))]} /><ColumnSort column="Uploaded by" sort={sort} onSort={sortColumn} /></th>
                <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Created<ColumnFilter column="Created" value={columnFilters.Created ?? ""} onChange={(value) => setFilter("Created", value)} /><ColumnSort column="Created" sort={sort} onSort={sortColumn} /></th>
                <th className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">Action<ColumnSort column="Action" sort={sort} onSort={sortColumn} /></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((upload) => (
                <tr key={upload.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CqaIcon name={upload.sizeBytes === 0 ? "folder" : "draft"} className="text-[18px] text-[#9ca3af]" />
                      <span className="font-medium text-[#1f2937]">{upload.fileName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] capitalize text-[#4b5563]">{upload.kind === "other" && upload.sizeBytes === 0 ? "Folder" : upload.kind}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{upload.sizeBytes === 0 ? "—" : `${(upload.sizeBytes / 1024).toFixed(0)} KB`}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#4b5563]">{upload.uploadedBy}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#6b7280]" title={formatDateTime(upload.createdAt)}>
                    {formatDateTime(upload.createdAt)}
                  </td>
                  <td className="px-4 py-3"><DeleteUploadButton id={upload.id} name={upload.fileName} readOnly={readOnly} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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

