/*
 * Shared validation helpers reused across feature schemas.
 */

/**
 * Normalizes a form's empty/whitespace string to `undefined` (persist as
 * NULL). Also normalizes `null` to `undefined`: `FormData.get(name)` returns
 * `null` (not `""`) when no element with that `name` exists in the submitted
 * form at all — e.g. an optional field a particular form variant simply
 * doesn't render — and a bare `null` fails a Zod `.optional()` schema (which
 * only accepts `undefined`, never `null`, unless also `.nullable()`), so
 * without this a field that's legitimately absent from the DOM would reject
 * the entire submission with no visible cause.
 */
export const cleanOptional = (value: unknown) => {
  if (value === null) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

/** Maps an empty/whitespace string to `undefined` (used before optional coercion). */
export const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;
