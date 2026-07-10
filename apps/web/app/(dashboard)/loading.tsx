/* Shown while a dashboard route's server data loads. The dynamic pages fetch
   live data on every request, so this skeleton avoids a blank frame. */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading…</span>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-md bg-surface" />
          <div className="h-3.5 w-64 rounded bg-hairline" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-surface" />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-hairline bg-surface/40"
          />
        ))}
      </div>

      {/* Content card */}
      <div className="mt-6 rounded-2xl border border-hairline bg-surface/40">
        <div className="border-b border-hairline p-4">
          <div className="h-4 w-32 rounded bg-hairline" />
        </div>
        <div className="divide-y divide-hairline">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <span className="h-8 w-8 shrink-0 rounded-full bg-hairline" />
              <span className="h-3.5 w-40 rounded bg-hairline" />
              <span className="ml-auto h-5 w-16 rounded-full bg-hairline" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
