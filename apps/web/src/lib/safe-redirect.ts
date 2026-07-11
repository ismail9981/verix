/*
 * Open-redirect guard. Returns a value only if it is a safe *same-site*
 * relative path, otherwise the fallback. Pure and dependency-free so both the
 * client login form and the server auth-confirm route share one implementation.
 *
 * Rejected: absolute URLs, protocol-relative (`//host`), and backslash tricks
 * (`/\host`) that browsers normalize to a network path — all of which would
 * navigate off-site.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!value) return fallback;
  // Must start with a single "/" (a rooted path)...
  if (!value.startsWith("/")) return fallback;
  // ...but not "//" or "/\", which resolve to another origin.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
