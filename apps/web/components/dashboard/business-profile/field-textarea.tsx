"use client";

import { useId, type ChangeEvent } from "react";
import { FIELD_CONTROL_BASE, FIELD_LABEL } from "./field-styles";

interface FieldTextareaProps {
  label: string;
  name: string;
  defaultValue?: string;
  /** Provide `value` + `onChange` for controlled use. */
  value?: string;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  helperText?: string;
}

export function FieldTextarea({
  label,
  name,
  defaultValue,
  value,
  onChange,
  placeholder,
  rows = 4,
  helperText,
}: FieldTextareaProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const controlled = value !== undefined;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        {...(controlled ? { value, onChange } : { defaultValue })}
        placeholder={placeholder}
        aria-describedby={helperText ? helperId : undefined}
        className={`${FIELD_CONTROL_BASE} resize-y p-3 leading-relaxed`}
      />
      {helperText ? (
        <p id={helperId} className="text-xs text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
