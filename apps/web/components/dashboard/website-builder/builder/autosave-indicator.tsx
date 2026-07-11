"use client";

import type { EditorStatus } from "../../../../src/website/builder/use-section-editor";

/*
 * Autosave status pill. `aria-live="polite"` announces transitions to assistive
 * tech without stealing focus. Draft-only — publishing stays a manual action.
 */

const LABEL: Record<EditorStatus, string> = {
  saved: "All changes saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed — retrying",
};

const DOT: Record<EditorStatus, string> = {
  saved: "bg-emerald-400",
  dirty: "bg-amber-400",
  saving: "bg-sky-400 animate-pulse",
  error: "bg-red-400",
};

export function AutosaveIndicator({ status }: { status: EditorStatus }) {
  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs text-muted"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {LABEL[status]}
    </span>
  );
}
