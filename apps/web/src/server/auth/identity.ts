import { and, eq, isNull, sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { db } from "../db/db";
import { users } from "../db/schema";
import { logger } from "../observability/logger";

type Schema = typeof import("../db/schema");
export type IdentityTransaction = PgDatabase<
  PostgresJsQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

export interface AuthIdentity {
  readonly id: string;
  readonly email: string | null;
  readonly name?: string | null;
  readonly emailVerified: boolean;
}

export type IdentityResolutionKind =
  | "ALREADY_LINKED"
  | "LEGACY_LINKED"
  | "NEW_IDENTITY_PROVISIONED";

export interface InternalIdentityResolution {
  readonly userId: string;
  readonly kind: IdentityResolutionKind;
}

export type IdentityResolutionErrorCode =
  | "INVALID_AUTH_ID"
  | "MISSING_AUTH_EMAIL"
  | "UNVERIFIED_LEGACY_MATCH"
  | "AMBIGUOUS_LEGACY_MATCH"
  | "LINKAGE_CONFLICT"
  | "LINKED_USER_DELETED";

export class IdentityResolutionError extends Error {
  constructor(
    readonly code: IdentityResolutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IdentityResolutionError";
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedEmail(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function authUserRef(authUserId: string): string {
  return authUserId.slice(0, 8);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/**
 * Emits the security event only after the caller's transaction has committed.
 * UUIDs are shortened and email is never included in the structured payload.
 */
export function auditIdentityResolution(
  authUserId: string,
  result: InternalIdentityResolution,
): void {
  if (result.kind === "ALREADY_LINKED") return;
  logger.info(`identity.${result.kind.toLowerCase()}`, {
    authUserRef: authUserRef(authUserId),
    internalUserRef: result.userId.slice(0, 8),
  });
}

export function auditIdentityRefusal(
  authUserId: string,
  error: IdentityResolutionError,
): void {
  logger.warn("identity.linkage_refused", {
    authUserRef: authUserRef(authUserId),
    reason: error.code,
  });
}

/**
 * Canonical immutable identity resolver core. The caller owns the transaction
 * so user linkage and first-workspace provisioning can commit atomically.
 */
export async function resolveInternalIdentityInTransaction(
  tx: IdentityTransaction,
  authIdentity: AuthIdentity,
): Promise<InternalIdentityResolution> {
  if (!UUID_PATTERN.test(authIdentity.id)) {
    throw new IdentityResolutionError(
      "INVALID_AUTH_ID",
      "The authenticated identity is invalid.",
    );
  }

  const email = normalizedEmail(authIdentity.email);

  // Serialize retries for one Auth identity and, when present, one normalized
  // email. This keeps concurrent first-login attempts idempotent.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`verix:b4:auth:${authIdentity.id}`}, 0))`,
  );
  if (email) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`verix:b4:email:${email}`}, 0))`,
    );
  }

  const linked = await tx
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.authUserId, authIdentity.id))
    .limit(1);

  if (linked[0]) {
    if (linked[0].deletedAt !== null) {
      throw new IdentityResolutionError(
        "LINKED_USER_DELETED",
        "The linked account is unavailable.",
      );
    }
    return { userId: linked[0].id, kind: "ALREADY_LINKED" };
  }

  if (!email) {
    throw new IdentityResolutionError(
      "MISSING_AUTH_EMAIL",
      "The authenticated identity has no usable email address.",
    );
  }

  const emailMatches = await tx
    .select({ id: users.id, authUserId: users.authUserId })
    .from(users)
    .where(
      and(
        sql`lower(btrim(${users.email})) = ${email}`,
        isNull(users.deletedAt),
      ),
    )
    .limit(3);

  const linkedElsewhere = emailMatches.filter(
    ({ authUserId }) => authUserId !== null && authUserId !== authIdentity.id,
  );
  const unlinked = emailMatches.filter(({ authUserId }) => authUserId === null);

  if (linkedElsewhere.length > 0) {
    throw new IdentityResolutionError(
      "LINKAGE_CONFLICT",
      "The authenticated identity conflicts with an existing account.",
    );
  }
  if (unlinked.length > 1) {
    throw new IdentityResolutionError(
      "AMBIGUOUS_LEGACY_MATCH",
      "The legacy identity match is ambiguous.",
    );
  }

  if (unlinked[0]) {
    if (!authIdentity.emailVerified) {
      throw new IdentityResolutionError(
        "UNVERIFIED_LEGACY_MATCH",
        "A verified email is required to link the legacy account.",
      );
    }
    const updated = await tx
      .update(users)
      .set({ authUserId: authIdentity.id, emailVerified: true })
      .where(
        and(eq(users.id, unlinked[0].id), isNull(users.authUserId)),
      )
      .returning({ id: users.id });
    if (!updated[0]) {
      throw new IdentityResolutionError(
        "LINKAGE_CONFLICT",
        "The legacy account was linked concurrently.",
      );
    }
    return { userId: updated[0].id, kind: "LEGACY_LINKED" };
  }

  try {
    const inserted = await tx
      .insert(users)
      .values({
        authUserId: authIdentity.id,
        email,
        fullName: authIdentity.name?.trim() || null,
        emailVerified: authIdentity.emailVerified,
      })
      .returning({ id: users.id });
    return {
      userId: inserted[0]!.id,
      kind: "NEW_IDENTITY_PROVISIONED",
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new IdentityResolutionError(
        "LINKAGE_CONFLICT",
        "The authenticated identity conflicts with an existing account.",
      );
    }
    throw error;
  }
}

/** Standalone canonical resolver for server paths that do not provision scope. */
export async function resolveInternalIdentity(
  authIdentity: AuthIdentity,
): Promise<InternalIdentityResolution> {
  try {
    const result = await db.transaction((tx) =>
      resolveInternalIdentityInTransaction(tx, authIdentity),
    );
    auditIdentityResolution(authIdentity.id, result);
    return result;
  } catch (error) {
    if (error instanceof IdentityResolutionError) {
      auditIdentityRefusal(authIdentity.id, error);
    }
    throw error;
  }
}
