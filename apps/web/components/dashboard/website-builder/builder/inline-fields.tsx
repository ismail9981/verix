"use client";

import type { InlineTextField } from "../../../../src/website/render/types";

/*
 * On-canvas quick-edit for a section's plain-text props (heading, button label,
 * …). Editing here updates the same section props the drawer edits — no
 * duplicate editor logic — and the live preview reflects it immediately.
 */
export function InlineFields({
  fields,
  props,
  onChange,
}: {
  fields: readonly InlineTextField[];
  props: Record<string, unknown>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-hairline bg-canvas/40 p-3">
      {fields.map((field) => (
        <label key={field.key} className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {field.label}
          </span>
          <input
            type="text"
            value={String(props[field.key] ?? "")}
            onChange={(e) => onChange(field.key, e.target.value)}
            aria-label={`${field.label} (inline edit)`}
            className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
      ))}
    </div>
  );
}
