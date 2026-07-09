"use client";

import { FilterBar } from "../ui/filter-bar";
import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import {
  SERVICE_OPTIONS,
  STAFF_OPTIONS,
  STATUS_OPTIONS,
} from "./mock-data";
import type { BookingFilters } from "./types";

interface BookingFiltersBarProps {
  filters: BookingFilters;
  onChange: (filters: BookingFilters) => void;
}

const DATE_INPUT =
  "[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:invert";

export function BookingFiltersBar({ filters, onChange }: BookingFiltersBarProps) {
  const set = <K extends keyof BookingFilters>(key: K, value: BookingFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <FilterBar label="Filter bookings">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Customer or service…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          value={filters.search}
          onChange={(event) => set("search", event.target.value)}
        />
        <FieldSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(event) => set("status", event.target.value)}
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
        <FieldInput
          label="Date"
          type="date"
          className={DATE_INPUT}
          value={filters.date}
          onChange={(event) => set("date", event.target.value)}
        />
      </div>
    </FilterBar>
  );
}
