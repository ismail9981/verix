import { timestamp, uuid } from "drizzle-orm/pg-core";

/*
 * Reusable column helpers.
 *
 * Each is a function that returns *fresh* column builders, so spreading them
 * into multiple tables never shares a single builder instance. Keeping these
 * in one place guarantees every table uses identical primary-key, timestamp,
 * and soft-delete definitions.
 */

/** UUID primary key with a database-generated default. */
export const primaryId = () => uuid("id").primaryKey().defaultRandom();

/** Timezone-aware created_at / updated_at; updated_at auto-bumps on write. */
export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Nullable deleted_at — a non-null value marks the row as soft-deleted. */
export const softDelete = () => ({
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * ISO 4217 currency code shape (3 uppercase letters, e.g. "USD"). Every
 * `currency` text column in the schema is backed by a matching DB `CHECK`
 * constraint using this exact pattern (see `0014_billing.sql`) — shared here
 * so any TS-side validation (Zod schemas, tests) can't drift from the DB
 * constraint it mirrors.
 */
export const ISO_4217_CURRENCY_PATTERN = /^[A-Z]{3}$/;
