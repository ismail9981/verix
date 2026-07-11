export type FallbackReason = "unknown" | "invalid" | "error" | "version";

const MESSAGES: Record<FallbackReason, string> = {
  unknown: "Unknown section type",
  invalid: "This section has invalid content",
  error: "This section could not be displayed",
  version: "This section needs an update to display",
};

/* Graceful fallback rendered in place of a section that can't be shown. */
export function SectionFallback({
  typeKey,
  reason,
}: {
  typeKey: string;
  reason: FallbackReason;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-dashed border-hairline bg-surface/30 px-6 py-8 text-center"
    >
      <p className="text-sm font-medium text-white">{MESSAGES[reason]}</p>
      <p className="mt-1 text-xs text-muted">
        Section type: <span className="font-mono">{typeKey || "—"}</span>
      </p>
    </div>
  );
}
