import { SectionCard } from "../home/section-card";
import { TOP_SERVICES } from "./mock-data";

export function TopServices() {
  return (
    <SectionCard id="top-services" title="Top performing services">
      <ol className="flex flex-col gap-4">
        {TOP_SERVICES.map((service) => (
          <li key={service.rank} className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-xs font-semibold text-accent">
              {service.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-white">
                  {service.name}
                </span>
                <span className="shrink-0 text-sm font-medium text-white">
                  {service.revenue}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${service.share}%` }}
                  />
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {service.bookings} bookings
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
