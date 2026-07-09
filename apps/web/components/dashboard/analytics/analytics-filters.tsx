"use client";

import { FilterBar } from "../ui/filter-bar";
import { FieldSelect } from "../business-profile/field-select";
import { RANGE_OPTIONS, SERVICE_OPTIONS, STAFF_OPTIONS } from "./mock-data";
import type { AnalyticsFilters } from "./types";

interface AnalyticsFiltersBarProps {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
}

export function AnalyticsFiltersBar({
  filters,
  onChange,
}: AnalyticsFiltersBarProps) {
  const set = <K extends keyof AnalyticsFilters>(
    key: K,
    value: AnalyticsFilters[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <FilterBar label="Filter analytics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldSelect
          label="Date range"
          options={RANGE_OPTIONS}
          value={filters.range}
          onChange={(event) => set("range", event.target.value)}
        />
        <FieldSelect
          label="Service"
          options={SERVICE_OPTIONS}
          value={filters.service}
          onChange={(event) => set("service", event.target.value)}
        />
        <FieldSelect
          label="Staff"
          options={STAFF_OPTIONS}
          value={filters.staff}
          onChange={(event) => set("staff", event.target.value)}
        />
      </div>
    </FilterBar>
  );
}
