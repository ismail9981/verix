-- Property Management (Sprint 12): introduces `properties` and `buildings`
-- as new levels above the existing Sprint-11 `rental_units`, and moves
-- `rental_units` into that hierarchy (every unit now belongs to a workspace,
-- a property, and a building). Applied idempotently.
--
-- NOTE ON TOOLING: hand-written, following the same idempotent-DDL
-- convention as every migration since 0003_website_builder.sql —
-- `drizzle-kit generate`/`push` remain broken for this repo's unjournaled
-- migration history (see 0009_leads.sql's note); applied directly against
-- DATABASE_URL.
--
-- SCHEMA CHANGE NOTE: `rental_units.property_id`/`building_id` are added as
-- nullable, then backfilled (no-op — see below), then set NOT NULL. This is
-- safe because `rental_units` has zero rows in every environment this
-- migration has been applied to as of Sprint 12 (Sprint 11 shipped with no
-- rows ever written outside of live-verification scripts, which always clean
-- up after themselves). If a future environment ever has existing rows here,
-- this migration must be preceded by a backfill assigning a real property
-- and building to every existing row before the NOT NULL statements run.
--
-- `rental_units.status` (Sprint 11's active/inactive toggle) is dropped and
-- replaced by `status_override` (see rentalUnits's doc comment in
-- schema/tables.ts): the three states that toggle used to conflate
-- (bookable/not-bookable) are now covered by `status_override = 'out_of_service'`
-- (or null), while day-to-day occupancy is derived from reservations instead
-- of stored.

CREATE TABLE IF NOT EXISTS "properties" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "address_line1" text,
  "address_line2" text,
  "city" text,
  "state" text,
  "postal_code" text,
  "country" text,
  "description" text,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_workspace_idx" ON "properties" ("workspace_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "buildings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE restrict,
  "name" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buildings_workspace_idx" ON "buildings" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buildings_property_position_idx" ON "buildings" ("property_id", "position");--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "rental_unit_condition" AS ENUM ('cleaning', 'maintenance', 'out_of_service');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- Drop Sprint 11's active/inactive toggle in favor of status_override.
DROP INDEX IF EXISTS "rental_units_status_idx";--> statement-breakpoint
ALTER TABLE "rental_units" DROP COLUMN IF EXISTS "status";--> statement-breakpoint
DROP TYPE IF EXISTS "rental_unit_status";--> statement-breakpoint

ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "property_id" uuid REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "building_id" uuid REFERENCES "buildings"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "unit_number" text;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "floor" integer;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "bedrooms" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "bathrooms" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "size_sq_ft" integer;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "amenities" text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "rental_units" ADD COLUMN IF NOT EXISTS "status_override" "rental_unit_condition";--> statement-breakpoint

-- No backfill statement needed today (see note above — table is empty), but
-- the NOT NULL is only safe once every row has a property_id/building_id.
ALTER TABLE "rental_units" ALTER COLUMN "property_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_units" ALTER COLUMN "building_id" SET NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "rental_units_property_idx" ON "rental_units" ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_units_building_idx" ON "rental_units" ("building_id");--> statement-breakpoint

-- RLS: same workspace-membership policy pattern as every other tenant table.
-- `authenticated`-only grant — never `anon`.
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "properties" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "properties";--> statement-breakpoint
CREATE POLICY workspace_access ON "properties" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE "buildings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "buildings" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "buildings";--> statement-breakpoint
CREATE POLICY workspace_access ON "buildings" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
