import { randomBytes } from "node:crypto";

/*
 * Verification token generation. Split out from the domain services (which
 * import `db` at module scope) so this pure, node:crypto-only helper can be
 * unit-tested without pulling in a database connection.
 */

const TOKEN_BYTES = 20; // → 40 hex characters

/** An unpredictable, collision-resistant token for a custom domain's TXT record. */
export function generateVerificationToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}
