import { z } from "zod";

/*
 * Validation schemas for the auth flows. Server-side validation mirrors the
 * client-side field validators so requests are checked at the trust boundary.
 */

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required.").max(120),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const resetRequestSchema = z.object({
  email: z.email("Enter a valid email address."),
});
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
