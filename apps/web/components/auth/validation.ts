/* Pure, composable field validators. Each returns an error string or
   undefined, so they can be listed per field and run in order. */

export type Validator = (
  value: string,
  values: Record<string, string>,
) => string | undefined;

export const required =
  (label: string): Validator =>
  (value) =>
    value.trim().length > 0 ? undefined : `${label} is required.`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const email: Validator = (value) =>
  EMAIL_RE.test(value.trim()) ? undefined : "Enter a valid email address.";

export const minLength =
  (n: number, label = "Password"): Validator =>
  (value) =>
    value.length >= n ? undefined : `${label} must be at least ${n} characters.`;

export const matches =
  (field: string, label: string): Validator =>
  (value, values) =>
    value === values[field] ? undefined : `${label} do not match.`;
