import { createHash } from "node:crypto";
import { env } from "../env";

/*
 * Best-effort client IP extraction + privacy-safe hashing. Shared by
 * `proxy.ts` (auth-mutation rate limiting) and the public lead-submission
 * route (rate limiting + `leads.ip_hash`) so there is exactly one definition
 * of "which header is the client IP" — never duplicated per call site.
 */

export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/**
 * A salted SHA-256 hex digest of the client IP — never the raw address.
 * One-way and unreversible; still usable for per-visitor rate limiting and
 * abuse pattern detection without retaining PII.
 */
export function hashClientIp(ip: string): string {
  return createHash("sha256").update(`${env.LEAD_IP_HASH_SALT}:${ip}`).digest("hex");
}
