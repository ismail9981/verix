import type { ThemeDefinition } from "./types";
import { modernTheme } from "./themes/modern";
import { minimalTheme } from "./themes/minimal";
import { elegantTheme } from "./themes/elegant";

/*
 * The Theme Registry — a key→theme Map, exactly like the Section Registry.
 * Lookups are O(1) and there are no switch statements over theme keys.
 */

const REGISTRY = new Map<string, ThemeDefinition>();
REGISTRY.set(modernTheme.key, modernTheme);
REGISTRY.set(minimalTheme.key, minimalTheme);
REGISTRY.set(elegantTheme.key, elegantTheme);

/** The guaranteed-valid fallback used when a requested theme is missing/invalid. */
export const FALLBACK_THEME_KEY = modernTheme.key;

export function getTheme(key: string): ThemeDefinition | undefined {
  return REGISTRY.get(key);
}

export function hasTheme(key: string): boolean {
  return REGISTRY.has(key);
}

export function listThemes(): ThemeDefinition[] {
  return [...REGISTRY.values()];
}
