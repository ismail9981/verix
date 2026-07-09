import type { IconComponent } from "../types";
import { CARD } from "./card";

export interface StatItem {
  id: string;
  label: string;
  value: string;
  icon: IconComponent;
}

/* Shared 4-up stat grid used by the simple overview rows (Bookings, CRM, AI).
   Previously this exact markup was copied verbatim into three modules. */
export function StatGrid({
  stats,
  ariaLabel,
}: {
  stats: StatItem[];
  ariaLabel: string;
}) {
  return (
    <section aria-label={ariaLabel}>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ id, label, value, icon: Icon }) => (
          <div key={id} className={`${CARD} p-5`}>
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
