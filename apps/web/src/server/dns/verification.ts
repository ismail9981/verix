import type { DomainStatus } from "../validators/domain";

/*
 * Pure DNS-verification logic: normalization, TXT matching, and the
 * status-transition decision. No db, no network — the resolver (`./resolver`)
 * supplies raw records; this module only classifies and decides. Kept pure so
 * it's exhaustively unit-testable without a database (this repo's CI has none).
 */

/** Strip a trailing root-label dot and lowercase, e.g. `Example.com.` → `example.com`. */
export function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase();
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Node's `dns.resolveTxt` returns one array of string *chunks* per TXT record
 * (long values are split across 255-byte chunks at the protocol level and must
 * be concatenated back together, not treated as separate values).
 */
export function normalizeTxtRecord(chunks: readonly string[]): string {
  return chunks.join("").trim();
}

export type TxtMatchResult = "match" | "not_found" | "mismatch";

/** Compares every TXT record found at a name against the expected value. */
export function matchTxtRecords(
  records: readonly (readonly string[])[],
  expectedValue: string,
): TxtMatchResult {
  if (records.length === 0) return "not_found";
  const expected = expectedValue.trim();
  const found = records.some(
    (chunks) => normalizeTxtRecord(chunks) === expected,
  );
  return found ? "match" : "mismatch";
}

/**
 * DNS resolver shape the verification flow depends on — defined here (a pure,
 * server-only-free module) rather than in `./resolver` so tests can inject a
 * fake without ever importing the real `"server-only"`-tagged implementation.
 */
export interface DnsResolver {
  resolveTxtRecords(hostname: string): Promise<string[][]>;
  resolveCnameRecord(hostname: string): Promise<string[]>;
}

/**
 * Classifies a Node `dns` error code: "no such record" is a normal, expected
 * outcome (the owner hasn't published it yet) — everything else (timeouts,
 * SERVFAIL, connection issues) is transient and must not be treated as proof
 * the record doesn't exist.
 */
export function classifyDnsErrorCode(
  code: string | undefined,
): "not_found" | "transient" {
  return code === "ENOTFOUND" || code === "ENODATA" ? "not_found" : "transient";
}

/** The outcome of one verification attempt, already classified by the resolver layer. */
export type VerificationAttemptOutcome =
  | "match"
  | "not_found"
  | "mismatch"
  | "dns_error";

export interface VerificationDecision {
  status: DomainStatus;
  verified: boolean;
  /** Safe, user-facing message — never raw DNS/network error internals. */
  verificationError: string | null;
}

const MESSAGES: Record<Exclude<VerificationAttemptOutcome, "match">, string> =
  {
    not_found:
      "We couldn't find that DNS record yet. Add the TXT record shown below and try again — DNS changes can take a few minutes to propagate.",
    mismatch:
      "We found a TXT record at that name, but its value didn't match. Double-check you copied the value exactly and try again.",
    dns_error:
      "We couldn't complete the DNS lookup right now. This is usually temporary — try again in a few minutes.",
  };

/**
 * Decides the next domain status/error from a classified DNS outcome. A
 * transient `dns_error` deliberately leaves `status` unchanged (never demotes
 * to `failed` on a network hiccup) so retries stay cheap and the UI can show a
 * distinct "transient" state instead of a false negative.
 */
export function decideVerificationOutcome(
  outcome: VerificationAttemptOutcome,
  currentStatus: DomainStatus,
): VerificationDecision {
  if (outcome === "match") {
    return { status: "verified", verified: true, verificationError: null };
  }
  if (outcome === "dns_error") {
    return {
      status: currentStatus,
      verified: false,
      verificationError: MESSAGES.dns_error,
    };
  }
  return {
    status: "failed",
    verified: false,
    verificationError: MESSAGES[outcome],
  };
}
