import { APPOINTMENTS } from "./mock-data";
import { SectionCard } from "./section-card";
import type { AppointmentStatus } from "./types";

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  Confirmed: "bg-emerald-500/10 text-emerald-400",
  Pending: "bg-amber-500/10 text-amber-400",
  Completed: "bg-white/5 text-muted",
};

export function AppointmentsCard() {
  return (
    <SectionCard
      id="appointments"
      title="Today's schedule"
      bodyClassName="p-2"
      action={<span className="text-xs text-muted">{APPOINTMENTS.length} appointments</span>}
    >
      <ul>
        {APPOINTMENTS.map((appointment) => (
          <li
            key={appointment.id}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-canvas"
          >
            <span className="w-12 shrink-0 text-xs tabular-nums text-muted">
              {appointment.time}
            </span>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: appointment.color }}
            >
              {appointment.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">
                {appointment.name}
              </span>
              <span className="block truncate text-xs text-muted">
                {appointment.service}
              </span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[appointment.status]}`}
            >
              {appointment.status}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
