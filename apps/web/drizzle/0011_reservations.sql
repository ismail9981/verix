-- Reservations (Sprint 11): rentable-unit inventory (rooms/apartments/villas)
-- and workspace-scoped stay reservations, distinct from the existing
-- appointment-style `bookings` feature. Applied idempotently.
--
-- NOTE ON TOOLING: hand-written, following the same idempotent-DDL convention
-- as 0009_leads.sql/0010_crm_pipeline.sql — `drizzle-kit generate`/`push`
-- remain broken for this repo's unjournaled migration history (see 0009's
-- note); applied directly against DATABASE_URL.
--
-- Overlap prevention is enforced here at the database level via a partial
-- EXCLUDE constraint (not just the application layer): no two reservations
-- for the same unit can have overlapping `[check_in_date, check_out_date)`
-- ranges unless one of them is `cancelled`, `no_show`, or soft-deleted. This
-- requires the `btree_gist` extension (to combine a plain equality column
-- with a range-overlap check in one GiST index).

CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "reservation_status" AS ENUM ('inquiry', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "rental_unit_type" AS ENUM ('room', 'apartment', 'villa', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "rental_unit_status" AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "reservation_source" AS ENUM ('direct', 'phone', 'walk_in', 'website', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "rental_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "unit_type" "rental_unit_type" NOT NULL DEFAULT 'room',
  "description" text,
  "capacity" integer NOT NULL DEFAULT 1,
  "price_cents" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'usd',
  "status" "rental_unit_status" NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_units_workspace_idx" ON "rental_units" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_units_status_idx" ON "rental_units" ("status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "unit_id" uuid NOT NULL REFERENCES "rental_units"("id") ON DELETE restrict,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
  "staff_id" uuid REFERENCES "team_members"("id") ON DELETE set null,
  "status" "reservation_status" NOT NULL DEFAULT 'inquiry',
  "check_in_date" date NOT NULL,
  "check_out_date" date NOT NULL,
  "price_cents" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'usd',
  "source" "reservation_source" NOT NULL DEFAULT 'direct',
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "reservations_no_overlap_excl" EXCLUDE USING gist (
    "unit_id" WITH =,
    daterange("check_in_date", "check_out_date", '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show') AND deleted_at IS NULL)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_workspace_idx" ON "reservations" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_unit_idx" ON "reservations" ("unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_customer_idx" ON "reservations" ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_staff_idx" ON "reservations" ("staff_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_status_idx" ON "reservations" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_workspace_checkin_idx" ON "reservations" ("workspace_id", "check_in_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_workspace_checkout_idx" ON "reservations" ("workspace_id", "check_out_date");--> statement-breakpoint

-- RLS: same workspace-membership policy pattern as every other tenant table.
-- `authenticated`-only grant — never `anon`.
ALTER TABLE "rental_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "rental_units" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "rental_units";--> statement-breakpoint
CREATE POLICY workspace_access ON "rental_units" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE "reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "reservations" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "reservations";--> statement-breakpoint
CREATE POLICY workspace_access ON "reservations" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
