import { SectionCard } from "../home/section-card";
import { DonutChart } from "./donut-chart";
import type { TrafficSource } from "./types";

/* Donut + legend for a categorical distribution (booking status, payment
   method, payment status). Reuses the shared DonutChart primitive. */
export function DistributionCard({
  id,
  title,
  segments,
}: {
  id: string;
  title: string;
  segments: TrafficSource[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <SectionCard id={id} title={title}>
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No data for this range.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8">
          <DonutChart
            segments={segments.filter((s) => s.value > 0)}
            ariaLabel={`${title} breakdown`}
          />
          <ul className="flex w-full max-w-[12rem] flex-col gap-2.5">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-sm text-white">{s.label}</span>
                <span className="ml-auto text-sm tabular-nums text-muted">
                  {s.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
