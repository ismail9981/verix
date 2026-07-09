import { SectionCard } from "../home/section-card";
import { MEMBERS, WEEKDAYS } from "./mock-data";

/* Compact roster grid: one row per member, a cell per weekday that fills with
   the accent color when the member is scheduled. */
export function TeamSchedule() {
  return (
    <SectionCard id="schedule" title="Team schedule overview">
      <div className="flex flex-col gap-3">
        {/* Weekday header */}
        <div className="flex items-center gap-3">
          <span className="w-32 shrink-0" />
          <div className="grid flex-1 grid-cols-7 gap-1.5">
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-center text-[11px] text-muted">
                {day.charAt(0)}
              </span>
            ))}
          </div>
        </div>

        {/* Member rows */}
        <ul className="flex flex-col gap-2">
          {MEMBERS.map((member) => (
            <li key={member.id} className="flex items-center gap-3">
              <div className="flex w-32 shrink-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: member.color }}
                >
                  {member.initials}
                </span>
                <span className="truncate text-sm text-white">
                  {member.name.split(" ")[0]}
                </span>
              </div>
              <ul
                className="grid flex-1 grid-cols-7 gap-1.5"
                aria-label={`${member.name} weekly availability`}
              >
                {member.weekly.map((entry) => (
                  <li
                    key={entry.day}
                    title={`${entry.day}: ${entry.hours ?? "Off"}`}
                    className={`h-6 rounded-md ${
                      entry.hours ? "bg-accent/70" : "bg-canvas"
                    }`}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}
