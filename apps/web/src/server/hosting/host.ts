/*
 * Pure host-routing decision logic (Sprint 7.3). No db, no env, no server-only
 * import — every input is a plain value or an injected config object, so this
 * is exhaustively unit-testable and safe to share with client-side code later
 * if needed. `config.ts` is the only file that bridges this to `env`.
 *
 * This module answers two separate questions:
 *  1. normalizeHost   — is this a well-formed hostname, and what is its
 *     canonical (lowercase, no port, no trailing dot, punycode-ASCII) form?
 *  2. classifyHost    — given a normalized hostname, is this the app/dashboard
 *     itself, a candidate public-site hostname, or invalid?
 * `resolveIncomingHost` decides which header is authoritative for (1)'s input,
 * and `shouldSkipHostRewrite` guards path prefixes that must never be
 * rewritten regardless of host classification (also doubles as the
 * rewrite-loop guard: an internally-rewritten `/site/...` request is never
 * re-classified).
 */

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Avoids a literal control-character regex (flagged by `no-control-regex`). */
function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export interface NormalizedHost {
  /** Lowercase, punycode-ASCII, no port, no trailing dot. */
  hostname: string;
  /** The port from the input, if any (not part of `hostname`). */
  port: string | null;
}

/**
 * Parses and validates a raw `Host`-header-style value. Rejects control
 * characters and header-injection attempts up front (before any parsing), so
 * a value that later flows into a log line or response is already known-safe.
 * Uses the platform's `URL` parser for punycode/ASCII normalization rather
 * than hand-rolled IDNA handling.
 */
export function normalizeHost(raw: string | null | undefined): NormalizedHost | null {
  if (!raw) return null;
  // Checked before trimming: a trailing CR/LF is whitespace to `.trim()` but
  // is exactly the header-injection vector this guard exists to catch.
  if (hasControlCharacters(raw)) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 255) return null;
  // A bare host must not contain a path, userinfo, or scheme separator.
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("@")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(`http://${trimmed}`);
  } catch {
    return null;
  }
  // Parsing a bare host should never produce a path/query/fragment/userinfo;
  // if it did, the input smuggled more than a hostname.
  if (
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    return null;
  }

  let hostname = url.hostname;
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  if (!hostname) return null;

  return { hostname, port: url.port || null };
}

function isIpLiteral(hostname: string): boolean {
  return IPV4_RE.test(hostname) || hostname.startsWith("[");
}

function isLocalhostLike(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

export interface HostRoutingConfig {
  /** Exact hostnames that always serve the app/dashboard (never a customer site). */
  appHosts: ReadonlySet<string>;
  /** Customer subdomains live at `<label>.<publicRootDomain>`. */
  publicRootDomain: string;
  /** Gates IP-literal / bare-localhost leniency (dev convenience only). */
  isProduction: boolean;
}

export type HostClassification =
  | { kind: "app" }
  | { kind: "public"; hostname: string }
  | { kind: "invalid"; reason: string };

/**
 * Classifies a raw `Host` value as the application itself, a candidate public
 * site hostname, or invalid. Never touches the database — "public" only means
 * "worth asking the resolver about," not "resolves to a real site."
 */
export function classifyHost(
  raw: string | null | undefined,
  config: HostRoutingConfig,
): HostClassification {
  const normalized = normalizeHost(raw);
  if (!normalized) return { kind: "invalid", reason: "malformed host" };
  const { hostname } = normalized;

  if (isIpLiteral(hostname)) {
    return config.isProduction
      ? { kind: "invalid", reason: "IP literal" }
      : { kind: "app" };
  }
  if (isLocalhostLike(hostname)) {
    return config.isProduction
      ? { kind: "invalid", reason: "localhost in production" }
      : { kind: "app" };
  }
  if (config.appHosts.has(hostname)) return { kind: "app" };
  if (
    hostname === config.publicRootDomain ||
    hostname.endsWith(`.${config.publicRootDomain}`)
  ) {
    return { kind: "public", hostname };
  }
  // Any other well-formed hostname is a candidate custom domain; the DB
  // resolver is the source of truth for whether it actually maps to a site.
  return { kind: "public", hostname };
}

/**
 * Picks the authoritative host header. `Host` is trusted by default — on this
 * app's target deployment (Vercel), the `Host` header Next sees already is the
 * real per-domain hostname (Vercel terminates TLS per attached domain and
 * forwards it unmodified). `x-forwarded-host`/`forwarded` are only meaningful
 * behind an operator-controlled reverse proxy in front of that, so they are
 * read only when explicitly trusted — otherwise a client could spoof routing
 * by sending the header directly to the edge.
 */
export function resolveIncomingHost(
  headers: { get(name: string): string | null },
  trustForwardedHost: boolean,
): string | null {
  if (trustForwardedHost) {
    const forwarded = headers.get("x-forwarded-host");
    if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  }
  return headers.get("host");
}

// Path prefixes that must never be reconsidered for host-based rewriting,
// regardless of host classification. Includes the rewrite targets themselves
// (`/site`, `/domain-not-found`) so a request already routed there is never
// rewritten again — the loop-prevention guard.
const SKIP_REWRITE_PREFIXES = [
  "/_next",
  "/api",
  "/auth",
  "/favicon.ico",
  "/site",
  "/domain-not-found",
];

export function shouldSkipHostRewrite(pathname: string): boolean {
  return SKIP_REWRITE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Builds the internal rewrite target for a resolved public-host request,
 * preserving the original pathname under `/site/{siteId}` (query string is
 * preserved separately by cloning `nextUrl`, not by this function). Pulled
 * out as a pure function so path mapping — including the root-path special
 * case — is unit-testable without a request/DB.
 */
export function buildSiteRewritePath(siteId: string, pathname: string): string {
  const suffix = pathname === "/" ? "" : pathname;
  return `/site/${siteId}${suffix}`;
}
