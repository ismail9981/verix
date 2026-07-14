import { isValidHostname } from "../validators/domain";

/*
 * Guard evaluated immediately before any DNS lookup so we only ever resolve
 * the workspace's own stored, normalized custom-domain hostname — never a
 * user-influenced arbitrary target. Pure and dependency-free so it's cheap to
 * unit test exhaustively; the resolver (`./resolver`) calls it, not the other
 * way around.
 *
 * This isn't classic HTTP SSRF (we never fetch a URL), but the same discipline
 * applies: don't let a hostname that resolves to, or names, internal
 * infrastructure be used to make this server perform a lookup on an attacker's
 * behalf (a "DNS oracle"), and don't waste queries on inputs that can never be
 * a real public domain.
 */

const RESERVED_TLDS = new Set([
  "local",
  "internal",
  "localhost",
  "lan",
  "test",
  "invalid",
  "example",
  "arpa",
  "onion",
]);

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export interface HostnameSafetyResult {
  safe: boolean;
  reason?: string;
}

/** Whether `hostname` is a safe, well-formed public DNS name to resolve. */
export function isSafeToResolve(hostname: string): HostnameSafetyResult {
  const value = hostname.trim().toLowerCase();

  if (!value || value.length > 253) {
    return { safe: false, reason: "malformed hostname" };
  }
  if (value === "localhost" || value.endsWith(".localhost")) {
    return { safe: false, reason: "localhost is not resolvable" };
  }
  if (IPV4_RE.test(value)) {
    return { safe: false, reason: "IP literals are not resolvable" };
  }
  if (value.includes(":")) {
    // IPv6 literals (and nothing legitimate in a hostname contains a colon).
    return { safe: false, reason: "IP literals are not resolvable" };
  }
  if (!isValidHostname(value)) {
    return { safe: false, reason: "malformed hostname" };
  }

  const tld = value.split(".").pop() ?? "";
  if (RESERVED_TLDS.has(tld)) {
    return { safe: false, reason: "reserved/internal domain" };
  }

  return { safe: true };
}
