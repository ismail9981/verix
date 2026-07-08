"use client";

import { useState } from "react";
import { FIELD_CONTROL_BASE } from "./field-styles";
import { BUSINESS_HOURS } from "./mock-data";
import { ProfileSection } from "./profile-section";
import { Toggle } from "./toggle";

const TIME_INPUT = `${FIELD_CONTROL_BASE} h-9 px-3 [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert`;

export function BusinessHours() {
  const [open, setOpen] = useState(BUSINESS_HOURS.map((day) => day.open));

  const setDayOpen = (index: number, value: boolean) =>
    setOpen((prev) => prev.map((current, i) => (i === index ? value : current)));

  return (
    <ProfileSection
      id="hours"
      title="Business hours"
      description="Set when you're open. Customers can only book within these hours."
    >
      <ul className="flex flex-col divide-y divide-hairline">
        {BUSINESS_HOURS.map((day, index) => {
          const isOpen = open[index] ?? false;
          return (
            <li
              key={day.day}
              className="grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[180px_1fr] sm:items-center"
            >
              <div className="flex items-center gap-3">
                <Toggle
                  checked={isOpen}
                  onChange={(value) => setDayOpen(index, value)}
                  label={`${day.day} ${isOpen ? "open" : "closed"}`}
                />
                <span className="text-sm font-medium text-white">{day.day}</span>
              </div>

              {isOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    name={`${day.day.toLowerCase()}-from`}
                    defaultValue={day.from}
                    aria-label={`${day.day} opening time`}
                    className={TIME_INPUT}
                  />
                  <span className="text-sm text-muted">to</span>
                  <input
                    type="time"
                    name={`${day.day.toLowerCase()}-to`}
                    defaultValue={day.to}
                    aria-label={`${day.day} closing time`}
                    className={TIME_INPUT}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted">Closed</span>
              )}
            </li>
          );
        })}
      </ul>
    </ProfileSection>
  );
}
