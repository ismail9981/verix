import { themeTokensSchema } from "./tokens";
import { getTheme } from "./registry";
import { modernTheme } from "./themes/modern";
import type { ResolvedTheme } from "./types";

/*
 * resolveTheme — turns a (possibly missing/unknown/invalid) theme key into a
 * usable set of tokens. Never throws:
 *   - no key            → default theme (status: ok)
 *   - unknown key       → fallback theme (status: fallback-unknown)
 *   - invalid tokens    → fallback theme (status: fallback-invalid)
 *
 * Constant time: one Map lookup + one schema parse. It returns the registry's
 * *stable* token objects (never a fresh clone), so the CSS-var cache
 * (WeakMap keyed by token identity) hits on every render.
 */

// Compile-time guaranteed, pre-validated fallback.
const FALLBACK = modernTheme;

export function resolveTheme(key: string | null | undefined): ResolvedTheme {
  if (!key) {
    return { key: FALLBACK.key, tokens: FALLBACK.tokens, status: "ok" };
  }

  const def = getTheme(key);
  if (!def) {
    return {
      key: FALLBACK.key,
      tokens: FALLBACK.tokens,
      status: "fallback-unknown",
    };
  }

  if (!themeTokensSchema.safeParse(def.tokens).success) {
    return {
      key: FALLBACK.key,
      tokens: FALLBACK.tokens,
      status: "fallback-invalid",
    };
  }

  return { key: def.key, tokens: def.tokens, status: "ok" };
}
