import { z } from "zod";

/*
 * Validation for the Business Profile form. Used at the web boundary (the
 * server action) before anything reaches the service layer, so services can
 * trust their inputs. Kept framework-agnostic and reusable by future route
 * handlers.
 *
 * Optional fields arrive from the form as empty strings; `cleanOptional`
 * normalizes "" (and whitespace) to `undefined` so they persist as NULL.
 */

const cleanOptional = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const updateWorkspaceProfileSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(120),
  slug: z
    .string()
    .trim()
    .min(1, "URL slug is required")
    .max(60)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and single hyphens",
    ),
  email: z.preprocess(cleanOptional, z.email("Enter a valid email").optional()),
  phone: z.preprocess(cleanOptional, z.string().max(40).optional()),
  website: z.preprocess(cleanOptional, z.url("Enter a valid URL").optional()),
  timezone: z.string().trim().min(1, "Timezone is required").max(60),
  currency: z.string().trim().min(1, "Currency is required").max(10),
  language: z.string().trim().min(1, "Language is required").max(20),
  logoUrl: z.preprocess(cleanOptional, z.url("Enter a valid URL").optional()),
  coverImageUrl: z.preprocess(
    cleanOptional,
    z.url("Enter a valid URL").optional(),
  ),
});

export type UpdateWorkspaceProfileInput = z.infer<
  typeof updateWorkspaceProfileSchema
>;
