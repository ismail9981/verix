"use client";

import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { SearchIcon } from "../icons";
import { FilterBar } from "../ui/filter-bar";
import { ROLE_OPTIONS, STATUS_OPTIONS } from "./mock-data";
import type { TeamFilters } from "./types";

interface TeamFiltersBarProps {
  filters: TeamFilters;
  onChange: (filters: TeamFilters) => void;
}

export function TeamFiltersBar({ filters, onChange }: TeamFiltersBarProps) {
  const set = <K extends keyof TeamFilters>(key: K, value: TeamFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <FilterBar label="Filter team">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldInput
          label="Search"
          type="search"
          placeholder="Name or email…"
          leftIcon={<SearchIcon className="h-4 w-4" />}
          value={filters.search}
          onChange={(event) => set("search", event.target.value)}
        />
        <FieldSelect
          label="Role"
          options={ROLE_OPTIONS}
          value={filters.role}
          onChange={(event) => set("role", event.target.value)}
        />
        <FieldSelect
          label="Status"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(event) => set("status", event.target.value)}
        />
      </div>
    </FilterBar>
  );
}
