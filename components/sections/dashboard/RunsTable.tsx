import { Badge } from "@/components/ui/Badge";
import type { RunDTO } from "@/lib/types";
import { formatUsdCompact } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Journal des exécutions (de la plus récente à la plus ancienne). */
export function RunsTable({ runs }: { runs: RunDTO[] }) {
  const rows = [...runs].reverse();

  return (
    <div id="runs" className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Test runs</p>
          <p className="text-xs text-slate-500">{runs.length} releases analysed by Ship</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-6 py-3">Release</th>
              <th className="px-6 py-3">Change</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Tests</th>
              <th className="px-6 py-3 text-right">Coverage</th>
              <th className="px-6 py-3 text-right">Score</th>
              <th className="px-6 py-3 text-right">Cost avoided</th>
              <th className="px-6 py-3 text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((run) => (
              <tr key={run.id} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-6 py-3">
                  <span className="font-medium text-slate-900">#{run.release}</span>
                  <span className="ml-2 font-mono text-xs text-slate-400">{run.version}</span>
                </td>
                <td className="px-6 py-3">
                  <p className="font-medium text-slate-800">{run.title}</p>
                  <p className="font-mono text-xs text-slate-400">
                    {run.branch} {run.prNumber ? `· PR #${run.prNumber}` : ""}
                  </p>
                </td>
                <td className="px-6 py-3">
                  {run.status === "SUCCESS" ? (
                    <Badge tone="success" dot>Passed</Badge>
                  ) : (
                    <Badge tone="danger" dot>Blocked</Badge>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-3 text-right tabular-nums text-slate-600">
                  {run.testsPassed}/{run.testsTotal}
                </td>
                <td className="px-6 py-3 text-right tabular-nums text-slate-600">{run.coverage}%</td>
                <td className="px-6 py-3 text-right font-medium tabular-nums text-slate-900">{run.qualityScore}</td>
                <td className="px-6 py-3 text-right tabular-nums text-slate-600">{formatUsdCompact(run.costAvoided)}</td>
                <td className="whitespace-nowrap px-6 py-3 text-right text-xs text-slate-400">
                  {dateFormat.format(new Date(run.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
