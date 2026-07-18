-- Housekeeping & Unit Operations (Sprint 13): introduces `housekeeping_tasks`
-- for cleaning/maintenance/inspection work tied to a rental unit, optionally
-- linked to the reservation that triggered it. Applied idempotently.
--
-- NOTE ON TOOLING: hand-written, following the same idempotent-DDL
-- convention as every migration since 0003_website_builder.sql —
-- `drizzle-kit generate`/`push` remain broken for this repo's unjournaled
-- migration history (see 0009_leads.sql's note); applied directly against
-- DATABASE_URL.

DO $$ BEGIN
  CREATE TYPE "housekeeping_task_type" AS ENUM ('cleaning', 'inspection', 'maintenance', 'linen_change', 'restocking', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "housekeeping_task_status" AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "housekeeping_task_priority" AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "housekeeping_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE restrict,
  "building_id" uuid NOT NULL REFERENCES "buildings"("id") ON DELETE restrict,
  "unit_id" uuid NOT NULL REFERENCES "rental_units"("id") ON DELETE restrict,
  "reservation_id" uuid REFERENCES "reservations"("id") ON DELETE restrict,
  "task_type" "housekeeping_task_type" NOT NULL,
  "status" "housekeeping_task_status" NOT NULL DEFAULT 'pending',
  "priority" "housekeeping_task_priority" NOT NULL DEFAULT 'normal',
  "assigned_to" uuid REFERENCES "team_members"("id") ON DELETE set null,
  "title" text NOT NULL,
  "description" text,
  "due_date" date,
  "due_time" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "completed_by" uuid REFERENCES "team_members"("id") ON DELETE set null,
  "notes" text,
  "created_by" uuid REFERENCES "team_members"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "housekeeping_tasks_workspace_idx" ON "housekeeping_tasks" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_unit_idx" ON "housekeeping_tasks" ("unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_property_idx" ON "housekeeping_tasks" ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_building_idx" ON "housekeeping_tasks" ("building_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_assigned_idx" ON "housekeeping_tasks" ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_status_idx" ON "housekeeping_tasks" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_task_type_idx" ON "housekeeping_tasks" ("task_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_priority_idx" ON "housekeeping_tasks" ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_due_date_idx" ON "housekeeping_tasks" ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_reservation_idx" ON "housekeeping_tasks" ("reservation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "housekeeping_tasks_deleted_idx" ON "housekeeping_tasks" ("deleted_at");--> statement-breakpoint

-- At most one non-deleted automatic checkout cleaning task per reservation
-- (idempotent-retry guarantee for `updateReservationStatus`'s auto-created task).
CREATE UNIQUE INDEX IF NOT EXISTS "housekeeping_checkout_task_uq" ON "housekeeping_tasks" ("reservation_id", "task_type")
  WHERE (reservation_id is not null and task_type = 'cleaning' and deleted_at is null);--> statement-breakpoint

-- RLS: same workspace-membership policy pattern as every other tenant table.
-- `authenticated`-only grant — never `anon`.
ALTER TABLE "housekeeping_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "housekeeping_tasks" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "housekeeping_tasks";--> statement-breakpoint
CREATE POLICY workspace_access ON "housekeeping_tasks" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
