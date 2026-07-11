import type { ThemeTokens } from "./tokens";

/*
 * Theme registry types — mirrors the Section Registry. A theme is a reusable,
 * versionable collection of design tokens plus display metadata.
 */

export interface ThemePreviewMeta {
  /** Swatch colors shown in the theme picker (hex). */
  swatches: string[];
  /** A short sample used for a font/mood preview. */
  sample: string;
}

export interface ThemeMetadata {
  tags: string[];
  /** e.g. "light" | "dark" — for filtering/UX only. */
  mode: "light" | "dark";
}

export interface ThemeDefinition {
  key: string;
  version: number;
  displayName: string;
  description: string;
  category: string;
  tokens: ThemeTokens;
  preview: ThemePreviewMeta;
  metadata: ThemeMetadata;
}

/** Result of resolving a theme key: always a usable theme (never throws). */
export interface ResolvedTheme {
  key: string;
  tokens: ThemeTokens;
  status: "ok" | "fallback-unknown" | "fallback-invalid";
}
