import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Database schema (Drizzle ORM, PostgreSQL).
 *
 * Phase 2 infrastructure only — this defines a single example `users` table
 * so the ORM, migrations, and typing are wired end-to-end. Additional tables
 * (workspaces, bookings, customers, …) are added in later feature phases.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A row selected from `users`. */
export type User = typeof users.$inferSelect;

/** The shape required to insert a new `users` row. */
export type NewUser = typeof users.$inferInsert;
