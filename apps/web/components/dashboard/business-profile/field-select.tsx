"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { ChevronDownIcon } from "../../landing/icons";
import { FIELD_CONTROL_BASE, FIELD_LABEL } from "./field-styles";
import type { SelectOption } from "./types";

interface FieldSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  containerClassName?: string;
}

/* Native <select> styled to match the shared Input. Native keeps it fully
   accessible and keyboard-operable; the chevron is decorative. Extra native
   props (name, value/onChange, defaultValue, disabled…) forward to <select>,
   so it works both uncontrolled and controlled. */
export function FieldSelect({
  label,
  options,
  containerClassName,
  id: idProp,
  className,
  ...props
}: FieldSelectProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  return (
    <div className={`flex w-full flex-col gap-1.5 ${containerClassName ?? ""}`}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          {...props}
          className={`${FIELD_CONTROL_BASE} h-10 appearance-none pl-3 pr-9 ${className ?? ""}`}
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
