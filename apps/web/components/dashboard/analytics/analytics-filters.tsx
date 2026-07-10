"use client";

import { FilterBar } from "../ui/filter-bar";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import type { AnalyticsRange } from "../../../src/server/validators/analytics";

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

const DATE_INPUT =
  "[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert";

interface AnalyticsFiltersBarProps {
  range: AnalyticsRange;
  from: string;
  to: string;
  onRange: (value: AnalyticsRange) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}

export function AnalyticsFiltersBar({
  range,
  from,
  to,
  onRange,
  onFrom,
  onTo,
}: AnalyticsFiltersBarProps) {
  const custom = range === "custom";

  return (
    <FilterBar label="Filter analytics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldSelect
          label="Date range"
          options={RANGE_OPTIONS}
          value={range}
          onChange={(event) => onRange(event.target.value as AnalyticsRange)}
        />
        {custom ? (
          <>
            <FieldInput
              label="From"
              type="date"
              className={DATE_INPUT}
              value={from}
              onChange={(event) => onFrom(event.target.value)}
            />
            <FieldInput
              label="To"
              type="date"
              className={DATE_INPUT}
              value={to}
              onChange={(event) => onTo(event.target.value)}
            />
          </>
        ) : null}
      </div>
    </FilterBar>
  );
}
