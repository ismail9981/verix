import type { z } from "zod";

/*
 * Shared result contract for Server Actions, so every feature returns the
 * same typed shape to its client form (status + message + optional per-field
 * errors). Keeping this in one place avoids re-declaring it per feature.
 */

export type FieldErrors = Partial<Record<string, string[]>>;

export interface FormActionResult {
  status: "success" | "error";
  message: string;
  fieldErrors?: FieldErrors;
}

/** Flatten a ZodError into `{ field: [messages] }` keyed by the first path segment. */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}
