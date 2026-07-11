import { z } from "zod";

/*
 * Strongly-typed, Zod-validated theme tokens. A Theme is a collection of these
 * tokens; sections consume them only through CSS variables (see css-vars.ts),
 * never by reading token values directly.
 */

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color");

// A non-empty CSS value (length, box-shadow, font stack, …).
const cssValue = z.string().trim().min(1);

export const colorTokensSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  muted: hexColor,
  border: hexColor,
  success: hexColor,
  warning: hexColor,
  danger: hexColor,
});

export const typographyTokensSchema = z.object({
  headingFont: cssValue,
  bodyFont: cssValue,
  fontScale: z.number().min(0.75).max(2),
});

export const radiusTokensSchema = z.object({
  xs: cssValue,
  sm: cssValue,
  md: cssValue,
  lg: cssValue,
  xl: cssValue,
});
export type RadiusKey = keyof z.infer<typeof radiusTokensSchema>;

export const shadowTokensSchema = z.object({
  sm: cssValue,
  md: cssValue,
  lg: cssValue,
});

export const layoutTokensSchema = z.object({
  contentWidth: cssValue,
  sectionSpacing: cssValue,
  containerPadding: cssValue,
});

export const BUTTON_VARIANTS = ["solid", "outline", "ghost"] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
export const BUTTON_SIZES = ["sm", "md", "lg"] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];

export const buttonTokensSchema = z.object({
  variant: z.enum(BUTTON_VARIANTS),
  radius: z.enum(["xs", "sm", "md", "lg", "xl"]),
  size: z.enum(BUTTON_SIZES),
});

export const themeTokensSchema = z.object({
  colors: colorTokensSchema,
  typography: typographyTokensSchema,
  radius: radiusTokensSchema,
  shadows: shadowTokensSchema,
  layout: layoutTokensSchema,
  buttons: buttonTokensSchema,
});

export type ColorTokens = z.infer<typeof colorTokensSchema>;
export type ThemeTokens = z.infer<typeof themeTokensSchema>;
