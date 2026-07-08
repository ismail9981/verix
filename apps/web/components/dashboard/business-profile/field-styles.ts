/* Shared dark form-control styling so every field on the page (the reused
   Input, plus the local Select / Textarea) looks identical. Defined once. */

/** Overrides applied to the shared @repo/ui Input's element (merged via twMerge). */
export const INPUT_DARK =
  "bg-canvas border-hairline text-white placeholder:text-muted focus-visible:ring-accent focus-visible:ring-offset-canvas disabled:bg-surface";

/** Container overrides for the shared Input (recolors label / error / toggle). */
export const FIELD_CONTAINER =
  "w-full [&_label]:text-white [&_p[role=alert]]:text-red-400 [&_button]:text-muted [&_button:hover]:text-white";

export const FIELD_LABEL = "text-sm font-medium text-white";

/** Base styling for native controls (select, textarea) to match the Input. */
export const FIELD_CONTROL_BASE =
  "w-full rounded-md border border-hairline bg-canvas text-sm text-white placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50";
