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
