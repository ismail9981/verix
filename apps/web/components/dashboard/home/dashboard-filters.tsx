"use client";

import { FilterBar } from "../ui/filter-bar";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import type { DashboardAnalyticsRange } from "../../../src/server/validators/dashboard-analytics";
import { MAX_CUSTOM_RANGE_DAYS } from "../../../src/server/validators/dashboard-analytics";

/*
 * Self-contained date-range filter for the dashboard's analytics widgets
 * (Sprint 18) — deliberately its own component, not imported from or shared
 * with `components/dashboard/analytics/analytics-filters.tsx`. That
 * component backs the separate, out-of-scope `/analytics` page; this one is
 * independently evolvable, even though the interaction shape (preset select
 * + optional custom from/to) intentionally matches it for a consistent UX.
 */

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

const DATE_INPUT =
  "[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert";

interface DashboardFiltersBarProps {
  range: DashboardAnalyticsRange;
  from: string;
  to: string;
  onRange: (value: DashboardAnalyticsRange) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  error?: string;
}

export function DashboardFiltersBar({
  range,
  from,
  to,
  onRange,
  onFrom,
  onTo,
  error,
}: DashboardFiltersBarProps) {
  const custom = range === "custom";

  return (
    <FilterBar label="Filter dashboard analytics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldSelect
          label="Date range"
          options={RANGE_OPTIONS}
          value={range}
          onChange={(event) => onRange(event.target.value as DashboardAnalyticsRange)}
        />
        {custom ? (
          <>
            <FieldInput
              label="From"
              type="date"
              className={DATE_INPUT}
              value={from}
              onChange={(event) => onFrom(event.target.value)}
              aria-invalid={Boolean(error) || undefined}
            />
            <FieldInput
              label="To"
              type="date"
              className={DATE_INPUT}
              value={to}
              onChange={(event) => onTo(event.target.value)}
              aria-invalid={Boolean(error) || undefined}
            />
          </>
        ) : null}
      </div>
      {custom ? (
        <p className={`mt-2 text-xs ${error ? "text-red-400" : "text-muted"}`} role={error ? "alert" : undefined}>
          {error ?? `Choose up to ${MAX_CUSTOM_RANGE_DAYS} calendar days.`}
        </p>
      ) : null}
    </FilterBar>
  );
}
