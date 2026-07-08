import { UploadIcon } from "../business-profile/icons";

interface UploadPlaceholderProps {
  label: string;
  hint: string;
  className?: string;
}

/* Dashed upload target (no backend). A real, focusable button so it reads as
   interactive; wired to an uploader in a later sprint. */
export function UploadPlaceholder({ label, hint, className }: UploadPlaceholderProps) {
  return (
    <button
      type="button"
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-canvas/40 p-5 text-center transition-colors hover:border-accent/50 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className ?? ""}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <UploadIcon className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium text-white">{label}</span>
      <span className="text-xs text-muted">{hint}</span>
    </button>
  );
}
