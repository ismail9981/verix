/*
 * Shared validation helpers reused across feature schemas.
 */

/** Normalizes a form's empty/whitespace string to `undefined` (persist as NULL). */
export const cleanOptional = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

/** Maps an empty/whitespace string to `undefined` (used before optional coercion). */
export const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
