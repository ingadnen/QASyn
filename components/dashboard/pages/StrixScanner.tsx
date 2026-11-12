"use client";

import { useMemo, useState } from "react";
import { CqaIcon, cqaBtnPrimary, cqaCard, cqaInput } from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import type { StrixFinding, StrixReport, StrixSeverity } from "@/lib/strix";
import { cn } from "@/lib/utils";
import { ColumnFilter, ColumnSort, matchesColumnFilters, nextTableSort, sortTableRows, type TableSortState } from "@/components/contextqa/table-ui";

const SEVERITY_STYLE: Record<StrixSeverity, string> = {
  critical: "bg-[#fef2f2] text-[#b42318] border-[#fecdca]",
  high: "bg-[#fff4ed] text-[#b93815] border-[#fed7aa]",
  medium: "bg-[#fffaeb] text-[#b54708] border-[#fde68a]",
  low: "bg-[#eff8ff] text-[#175cd3] border-[#bfdbfe]",
  info: "bg-[#f9fafb] text-[#4b5563] border-[#e5e7eb]",
};

function GradeBadge({ grade, score }: { grade: StrixReport["grade"]; score: number }) {
  const tone =
    grade === "A" || grade === "B"
      ? "border-[#abefc6] bg-[#ecfdf3] text-[#067647]"
      : grade === "C"
        ? "border-[#fde68a] bg-[#fffbeb] text-[#b54708]"
        : "border-[#fecdca] bg-[#fef3f2] text-[#b42318]";
  return (
    <div className={cn("flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border", tone)} data-grade={grade}>
      <span className="text-[20px] font-bold leading-5">{grade}</span>
      <span className="mt-0.5 text-[10px] font-medium">{score}/100</span>
    </div>
  );
}

function FindingRow({ finding }: { finding: StrixFinding }) {
  return (
    <li
      data-finding={finding.id}
      data-severity={finding.severity}
      className="rounded-lg border border-[#eef0f3] px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded border px-1.5 py-[1px] text-[10px] font-semibold uppercase", SEVERITY_STYLE[finding.severity])}>
          {finding.severity}
        </span>
        <span className="text-[12px] font-medium text-[#111827]">{finding.title}</span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-semibold",
            finding.passed ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#fef3f2] text-[#b42318]",
          )}
        >
          <CqaIcon name={finding.passed ? "check" : "close"} className="text-[12px]" />
          {finding.passed ? "Pass" : "Fix"}
        </span>
      </div>
      <p className="mt-1 break-words font-mono text-[10.5px] leading-4 text-[#6b7280]">{finding.evidence}</p>
      {!finding.passed && (
        <p className="mt-1 text-[11px] leading-4 text-[#374151]">
          <span className="font-semibold">Remediation:</span> {finding.remediation}
        </p>
      )}
      <p className="mt-0.5 text-[10px] text-[#9ca3af]">{finding.owasp}</p>
    </li>
  );
}

/** Passive Strix security scanner shared by Security testing and Red team. */
export function StrixScanner({ readOnly = false, defaultTarget = "https://www.cgi.com" }: { readOnly?: boolean; defaultTarget?: string }) {
  const [target, setTarget] = useState(defaultTarget);
  const [report, setReport] = useState<StrixReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cookieColumnFilters, setCookieColumnFilters] = useState<Record<string, string>>({});
  const [cookieSort, setCookieSort] = useState<TableSortState>(null);

  const visibleCookies = useMemo(
    () =>
      sortTableRows(
        (report?.cookies ?? []).filter((cookie) =>
          matchesColumnFilters(cookieColumnFilters, {
            Name: cookie.name,
            Secure: cookie.secure ? "yes" : "no",
            HttpOnly: cookie.httpOnly ? "yes" : "no",
            SameSite: cookie.sameSite,
          }),
        ),
        cookieSort,
        {
          Name: (cookie) => cookie.name,
          Secure: (cookie) => (cookie.secure ? 1 : 0),
          HttpOnly: (cookie) => (cookie.httpOnly ? 1 : 0),
          SameSite: (cookie) => cookie.sameSite,
        },
      ),
    [report, cookieColumnFilters, cookieSort],
  );
  const cookieSortColumn = (column: string) => setCookieSort((current) => nextTableSort(current, column));

  async function scan() {
    setLoading(true);
    setError(null);
    try {
      setReport(await apiFetch<StrixReport>("/api/dashboard/strix", { method: "POST", json: { url: target } }));
    } catch (cause) {
      setError(errorMessage(cause));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  const failed = report?.findings.filter((finding) => !finding.passed && finding.severity !== "info") ?? [];

  return (
    <section className={cn(cqaCard, "p-4")} data-testid="strix-scanner">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-[#111827]">
            <CqaIcon name="shield" className="text-[18px] text-[#4f46e5]" /> Strix AI Security &amp; OWASP Inspector
          </h2>
          <p className="mt-0.5 text-[12px] text-[#6b7280]">
            Passive audit of CSP, HSTS, frame protection, content-type, referrer, permissions, cookies and exposed
            surface. One GET request, no exploit payload.
          </p>
        </div>
        <span className="rounded-full border border-[#ddd6fe] bg-[#f5f3ff] px-2.5 py-1 text-[10.5px] font-semibold text-[#5b4ee8]">
          Defensive · SSRF-safe
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className={cn(cqaInput, "h-9 min-w-[260px] flex-1")}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          aria-label="Strix scan target"
          placeholder="https://www.cgi.com"
        />
        <button type="button" data-testid="strix-scan" className={cqaBtnPrimary} disabled={readOnly || loading} onClick={() => void scan()}>
          <CqaIcon name="radar" className="text-[16px]" />
          {loading ? "Scanning…" : "Run passive scan"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[12px] text-[#b42318]">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#eef0f3] bg-[#fafafa] p-3">
            <GradeBadge grade={report.grade} score={report.score} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#111827]">{report.target}</p>
              <p className="mt-0.5 text-[11.5px] text-[#6b7280]">
                {report.reachable ? `HTTP ${report.httpStatus}` : "Unreachable"} · {failed.length} open finding(s) ·{" "}
                {report.findings.length} checks
              </p>
              <p className="mt-0.5 text-[10.5px] text-[#9ca3af]">
                {new Date(report.scannedAt).toLocaleString("en-US")}
              </p>
            </div>
          </div>

          {report.error && (
            <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[11.5px] text-[#92400e]">{report.error}</p>
          )}

          {report.surface.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {report.surface.map((item) => (
                <span key={item} className="rounded-full border border-[#e5e7eb] bg-white px-2 py-0.5 text-[10.5px] text-[#4b5563]">
                  {item}
                </span>
              ))}
            </div>
          )}

          {report.findings.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">Remediation report</p>
              <ul className="max-h-[420px] space-y-1.5 overflow-y-auto">
                {report.findings.map((finding) => <FindingRow key={finding.id} finding={finding} />)}
              </ul>
            </div>
          )}

          {report.cookies.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">Cookies</p>
              <div className="overflow-x-auto rounded-lg border border-[#eef0f3]">
                <table className="w-full min-w-[420px] text-left text-[11.5px]">
                  <thead className="bg-[#fafafa] text-[10.5px] uppercase tracking-wide text-[#9ca3af]">
                    <tr>
                      <th className="px-3 py-1.5 font-semibold">Name<ColumnFilter column="Name" value={cookieColumnFilters.Name ?? ""} onChange={(value) => setCookieColumnFilters((current) => ({ ...current, Name: value }))} /><ColumnSort column="Name" sort={cookieSort} onSort={cookieSortColumn} /></th>
                      <th className="px-3 py-1.5 font-semibold">Secure<ColumnFilter column="Secure" value={cookieColumnFilters.Secure ?? ""} onChange={(value) => setCookieColumnFilters((current) => ({ ...current, Secure: value }))} options={["yes", "no"]} /><ColumnSort column="Secure" sort={cookieSort} onSort={cookieSortColumn} /></th>
                      <th className="px-3 py-1.5 font-semibold">HttpOnly<ColumnFilter column="HttpOnly" value={cookieColumnFilters.HttpOnly ?? ""} onChange={(value) => setCookieColumnFilters((current) => ({ ...current, HttpOnly: value }))} options={["yes", "no"]} /><ColumnSort column="HttpOnly" sort={cookieSort} onSort={cookieSortColumn} /></th>
                      <th className="px-3 py-1.5 font-semibold">SameSite<ColumnFilter column="SameSite" value={cookieColumnFilters.SameSite ?? ""} onChange={(value) => setCookieColumnFilters((current) => ({ ...current, SameSite: value }))} /><ColumnSort column="SameSite" sort={cookieSort} onSort={cookieSortColumn} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCookies.length === 0 && (
                      <tr className="border-t border-[#f3f4f6] text-[#9ca3af]"><td colSpan={4} className="px-3 py-2 text-center">No cookies match the current filters.</td></tr>
                    )}
                    {visibleCookies.map((cookie) => (
                      <tr key={cookie.name} className="border-t border-[#f3f4f6] text-[#374151]">
                        <td className="px-3 py-1.5 font-mono">{cookie.name}</td>
                        <td className="px-3 py-1.5">{cookie.secure ? "yes" : "no"}</td>
                        <td className="px-3 py-1.5">{cookie.httpOnly ? "yes" : "no"}</td>
                        <td className="px-3 py-1.5">{cookie.sameSite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <ul className="list-disc space-y-0.5 pl-4 text-[10.5px] leading-4 text-[#9ca3af]">
            {report.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
