import { STATS } from "./mock-data";

export function CrmStats() {
  return (
    <section aria-label="Customer statistics">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map(({ id, label, value, icon: Icon }) => (
          <div
            key={id}
            className="rounded-2xl border border-hairline bg-surface/40 p-5"
          >
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted">{label}</dt>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <dd className="mt-3 text-2xl font-bold tracking-tight text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
