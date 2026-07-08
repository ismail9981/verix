"use client";

import { useId } from "react";
import { ChevronDownIcon } from "../../landing/icons";
import { FIELD_CONTROL_BASE, FIELD_LABEL } from "./field-styles";
import type { SelectOption } from "./types";

interface FieldSelectProps {
  label: string;
  name: string;
  options: SelectOption[];
  defaultValue?: string;
}

/* Native <select> styled to match the shared Input. Native keeps it fully
   accessible and keyboard-operable; the chevron is decorative. */
export function FieldSelect({
  label,
  name,
  options,
  defaultValue,
}: FieldSelectProps) {
  const id = useId();
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          defaultValue={defaultValue}
          className={`${FIELD_CONTROL_BASE} h-10 appearance-none pl-3 pr-9`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
