import type { ThemeDefinition } from "./types";

/** Identity helper that gives each theme a consistent, checked shape. */
export function defineTheme(theme: ThemeDefinition): ThemeDefinition {
  return theme;
}
