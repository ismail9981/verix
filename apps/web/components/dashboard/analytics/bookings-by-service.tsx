import { SectionCard } from "../home/section-card";
import { BOOKINGS_BY_SERVICE } from "./mock-data";

/* Horizontal bar chart — service names read better beside their bars. */
export function BookingsByService() {
  const max = Math.max(...BOOKINGS_BY_SERVICE.map((s) => s.value));

  return (
    <SectionCard id="bookings-by-service" title="Bookings by service">
      <ul
        className="flex flex-col gap-3"
        aria-label="Bookings by service"
      >
        {BOOKINGS_BY_SERVICE.map((service) => (
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
    </SectionCard>
  );
}
