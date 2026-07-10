import { SectionCard } from "../home/section-card";
import { BarChart } from "./bar-chart";
import { LineChart } from "./line-chart";
import type { AnalyticsPoint } from "./types";

function hasData(points: AnalyticsPoint[]): boolean {
  return points.some((p) => p.value > 0);
}

function EmptyChart() {
  return (
    <p className="py-12 text-center text-sm text-muted">
      No data for this range.
    </p>
  );
}

export function BookingsPerDay({ points }: { points: AnalyticsPoint[] }) {
  return (
    <SectionCard id="bookings-per-day" title="Bookings per day">
      {hasData(points) ? (
        <BarChart points={points} ariaLabel="Bookings per day" />
      ) : (
        <EmptyChart />
      )}
    </SectionCard>
  );
}

export function NewCustomers({ points }: { points: AnalyticsPoint[] }) {
  return (
    <SectionCard id="new-customers" title="New customers">
      {hasData(points) ? (
        <LineChart points={points} ariaLabel="New customers over time" />
      ) : (
        <EmptyChart />
      )}
    </SectionCard>
  );
}

/* Horizontal bars — service names read better beside their bars. */
export function TopBookedServices({ points }: { points: AnalyticsPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));

  return (
    <SectionCard id="top-booked-services" title="Top booked services">
      {points.length === 0 ? (
        <EmptyChart />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Top booked services">
          {points.map((service) => (
            <li key={service.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm text-white">
                {service.label}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-accent/50 to-accent"
                  style={{ width: `${(service.value / max) * 100}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted">
                {service.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
