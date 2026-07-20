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

/**
 * True if `amount` (a major-unit decimal, e.g. dollars) represents a whole
 * number of cents once converted — rejects values like `19.999` before they
 * reach `Math.round(amount * 100)`, which would otherwise silently truncate
 * to the nearest cent with no validation error. Tolerant of ordinary
 * floating-point representation noise (e.g. `19.99` stored internally as
 * `19.989999999999998`) via a small epsilon, so legitimate 2-decimal inputs
 * are never rejected. Promoted here (from `reservation.ts`) so every
 * money-input schema — reservations, rental units, invoices — imports one copy.
 */
export function hasAtMostCentsPrecision(amount: number): boolean {
  return Math.abs(Math.round(amount * 100) - amount * 100) < 1e-6;
}
