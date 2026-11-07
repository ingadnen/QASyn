/** Instant skeleton shown while a dashboard page streams in (0 ms perceived navigation). */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-lg bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
    </div>
  );
}
